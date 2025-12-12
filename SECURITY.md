# Security Architecture

This document details the security architecture and encryption implementation of SecurePass.

## Table of Contents
1. [Encryption Overview](#encryption-overview)
2. [Key Hierarchy](#key-hierarchy)
3. [Authentication](#authentication)
4. [Token Management](#token-management)
5. [CSRF Protection](#csrf-protection)
6. [Rate Limiting](#rate-limiting)
7. [Input Validation](#input-validation)
8. [Client-Side Encryption (Optional)](#client-side-encryption-optional)
9. [Production Recommendations](#production-recommendations)

---

## Encryption Overview

SecurePass uses **AES-256-GCM** (Advanced Encryption Standard with Galois/Counter Mode) for all encryption operations. This provides:

- **256-bit key security** - Resistant to brute-force attacks
- **Authenticated encryption** - Detects tampering via auth tag
- **Unique IVs** - Each encryption uses a random 96-bit initialization vector

### Encryption Parameters
```
Algorithm: AES-256-GCM
Key Length: 32 bytes (256 bits)
IV Length: 12 bytes (96 bits)
Auth Tag: 16 bytes (128 bits)
```

---

## Key Hierarchy

SecurePass uses a three-tier key hierarchy:

```
┌─────────────────────────────────────────┐
│         MASTER_KEY (Server Env)         │
│    32 bytes, base64 encoded             │
│    Used to wrap/unwrap user keys        │
└────────────────┬────────────────────────┘
                 │
                 │ wraps
                 ▼
┌─────────────────────────────────────────┐
│       Per-User Key (wrappedKey)         │
│    32 bytes, stored wrapped in DB       │
│    Unique per user                      │
└────────────────┬────────────────────────┘
                 │
                 │ encrypts
                 ▼
┌─────────────────────────────────────────┐
│         Vault Entry Passwords           │
│    Stored as: ciphertext + iv + tag     │
└─────────────────────────────────────────┘
```

### MASTER_KEY

- **Storage**: Environment variable (production: use KMS)
- **Format**: 32 bytes, base64 encoded
- **Purpose**: Wraps all per-user keys
- **Generation**: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

**⚠️ CRITICAL**: If MASTER_KEY is lost, ALL encrypted data is UNRECOVERABLE!

### Per-User Key

- **Generation**: Random 32 bytes on user creation
- **Storage**: Wrapped (encrypted) with MASTER_KEY, stored in `User.wrappedKey`
- **Format**: `base64(iv || authTag || encryptedKey)` = 60 bytes base64

```javascript
// Key wrapping
function wrapKey(userKey: Buffer, masterKey: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(userKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}
```

### Vault Entry Encryption

Each password is encrypted with the user's unwrapped key:

```javascript
// Encryption
function encryptVaultValue(plaintext: string, userKey: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', userKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}
```

---

## Authentication

### Password Hashing

Passwords are hashed using **bcrypt** with configurable salt rounds:

```javascript
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

// Registration
const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

// Login verification
const isValid = await bcrypt.compare(password, user.passwordHash);
```

**Salt Rounds Recommendations**:
| Rounds | Time    | Use Case |
|--------|---------|----------|
| 10     | ~100ms  | Development only |
| 12     | ~250ms  | Minimum production |
| 14     | ~1s     | High security |

### OAuth Flow

1. User clicks "Login with Google/GitHub"
2. Backend redirects to OAuth provider
3. Provider authenticates and redirects back to callback
4. Backend creates/links user, generates per-user key if needed
5. Backend sets refresh token in httpOnly cookie
6. Backend redirects to `FRONTEND_ORIGIN/oauth-success.html`
7. Frontend calls `/api/auth/refresh` to get access token

**Important**: Tokens are NEVER passed in URL parameters.

---

## Token Management

### Access Token
- **Type**: JWT (JSON Web Token)
- **Lifetime**: 15 minutes (configurable)
- **Storage**: Frontend memory (NOT localStorage)
- **Usage**: `Authorization: Bearer <token>` header

```javascript
// Payload structure
{
  sub: userId,      // User ID
  email: email,     // Optional
  type: 'access',
  iat: timestamp,
  exp: timestamp + 15min
}
```

### Refresh Token
- **Type**: Secure random token (32 bytes hex)
- **Lifetime**: 30 days (configurable)
- **Storage**: httpOnly cookie
- **Database**: SHA-256 hash stored, not plaintext

**Cookie Options**:
```javascript
{
  httpOnly: true,           // JavaScript cannot access
  secure: NODE_ENV === 'production',  // HTTPS only in prod
  sameSite: 'lax',          // Allows OAuth redirects
  path: '/api/auth',        // Only sent to auth endpoints
  expires: expiresAt        // 30 days
}
```

### Token Refresh Flow
```
1. Access token expires (401 response)
2. Frontend calls POST /api/auth/refresh (cookie sent automatically)
3. Backend validates refresh token hash in DB
4. Backend returns new access token
5. Frontend retries original request
```

---

## CSRF Protection

Since refresh tokens are stored in httpOnly cookies, we implement multiple CSRF protections:

### 1. Path-Scoped Cookies
Refresh token cookie is scoped to `/api/auth` only:
```javascript
path: '/api/auth'  // Cookie only sent to auth endpoints
```

### 2. SameSite Attribute
```javascript
sameSite: 'lax'  // Prevents cross-origin POST from other sites
```

### 3. Origin Validation
```javascript
// CORS configuration
cors({
  origin: process.env.FRONTEND_ORIGIN,
  credentials: true
})
```

### 4. Access Tokens in Memory
Access tokens are stored in JavaScript memory, not cookies, preventing CSRF on most endpoints.

### Additional CSRF Measures (if needed)
For enhanced security, implement CSRF tokens:
```javascript
// Generate CSRF token
const csrfToken = crypto.randomBytes(32).toString('hex');
// Store in session and validate on POST requests
```

---

## Rate Limiting

### General Rate Limiting
```javascript
rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: { error: 'Too many requests' }
})
```

### Auth Endpoint Rate Limiting
```javascript
rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 20,                    // 20 attempts per window
  message: { error: 'Too many authentication attempts' }
})
```

---

## Input Validation

All inputs are validated using **Zod** schemas:

```typescript
// Password creation schema
const createPasswordSchema = z.object({
  title: z.string().min(1).max(255),
  username: z.string().max(255).optional(),
  password: z.string().min(1).max(10000),
  site: z.string().url().optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  tags: z.array(z.string()).optional()
});

// Registration schema
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number'),
  name: z.string().min(1).max(255).optional()
});
```

---

## Client-Side Encryption (Optional)

SecurePass supports an optional client-side encryption mode where the server CANNOT decrypt passwords.

### How It Works
```
┌─────────────────────────────────────────┐
│         User Passphrase (client)        │
│    Entered by user, never sent to       │
│    server                               │
└────────────────┬────────────────────────┘
                 │
                 │ derives (PBKDF2)
                 ▼
┌─────────────────────────────────────────┐
│       Client Key (browser memory)       │
│    Derived from passphrase              │
│    Used to encrypt/decrypt locally      │
└────────────────┬────────────────────────┘
                 │
                 │ encrypts
                 ▼
┌─────────────────────────────────────────┐
│         Encrypted Data                  │
│    Sent to server as opaque blob        │
│    Server cannot decrypt                │
└─────────────────────────────────────────┘
```

### UX Tradeoffs

| Aspect | Server-Side | Client-Side |
|--------|-------------|-------------|
| **Security** | Server can decrypt | Zero-knowledge |
| **Lost Password** | Admin can help | DATA LOST FOREVER |
| **Multi-Device** | Seamless | Must enter passphrase |
| **Web Autofill** | Works | Limited |
| **API Access** | Full | Requires client |

### Implementation Notes

To enable client-side encryption:

1. **Key Derivation**:
```javascript
async function deriveKey(passphrase, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
```

2. **Store encrypted blob on server**:
```javascript
// Server stores this without ability to decrypt
{
  encryptedData: base64(iv + ciphertext + tag),
  // No per-user key wrapping needed
}
```

**⚠️ WARNING**: If user forgets passphrase, data is PERMANENTLY LOST. No recovery possible.

---

## Production Recommendations

### 1. Use KMS for MASTER_KEY
```javascript
// AWS KMS example
const AWS = require('aws-sdk');
const kms = new AWS.KMS();

async function getMasterKeyFromKMS() {
  const params = {
    KeyId: process.env.KMS_KEY_ID,
    KeySpec: 'AES_256'
  };
  const result = await kms.generateDataKey(params).promise();
  return result.Plaintext;
}
```

### 2. Rotate MASTER_KEY Periodically
```javascript
// 1. Generate new MASTER_KEY
// 2. For each user:
//    - Unwrap user key with old MASTER_KEY
//    - Wrap user key with new MASTER_KEY
//    - Update wrappedKey in database
// 3. Update MASTER_KEY in KMS/env
```

### 3. Enable HTTPS
```javascript
// Production cookie settings
secure: true,
sameSite: 'strict'  // or 'none' for cross-origin
```

### 4. Audit Logging
All sensitive operations are logged to `AuditLog` table:
- reveal, copy, create, update, delete
- login, logout, export, share
- IP address and timestamp recorded

### 5. Breach Monitoring (Future)
Integration with HaveIBeenPwned API to check for compromised credentials.

### 6. WebAuthn / Biometrics (Future)
Support for platform authenticators (FaceID, TouchID, Windows Hello) to allow secure device-level unlocking of the vault without re-typing the master password frequently.

### 7. Cloud Backup Security (Future)
When implementing cloud backups (Google Drive/Dropbox), ensure the vault is exported as an *encrypted blob* only. The cloud provider must never receive the decryption key.

---

## Security Checklist

- [x] AES-256-GCM encryption for all passwords
- [x] Per-user encryption keys
- [x] Keys wrapped with MASTER_KEY
- [x] bcrypt password hashing (12+ rounds)
- [x] Short-lived access tokens (15m)
- [x] httpOnly refresh token cookies
- [x] Path-scoped cookies (/api/auth)
- [x] SameSite=lax for CSRF protection
- [x] Rate limiting on auth endpoints
- [x] Zod input validation
- [x] Helmet security headers
- [x] No plaintext passwords in DB
- [x] Audit logging for sensitive actions
- [x] Secure random token generation

---

## Reporting Security Issues

If you discover a security vulnerability, please email security@example.com instead of creating a public issue.
