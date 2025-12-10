# SecurePass Backend

A secure password manager API built with Node.js, TypeScript, Express, and PostgreSQL.

## Features

- 🔐 **Email/Password Authentication** - Secure registration and login with bcrypt
- 🌐 **OAuth 2.0** - Login with Google (Gmail) and GitHub
- 🎫 **JWT Tokens** - Short-lived access tokens + httpOnly refresh token cookies
- 🔒 **Vault Encryption** - AES-256-GCM encryption for all stored passwords
- 🔑 **Key Wrapping** - Per-user encryption keys wrapped with server MASTER_KEY
- 🛡️ **Security** - Helmet, CORS, rate limiting, input validation

## Architecture

### Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  PostgreSQL │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │  Access Token     │  Refresh Token (httpOnly cookie)
       │  (in memory)      │  (stored hashed in DB)
       ▼                   ▼
   API Requests      Token Refresh
```

### Encryption Hierarchy

```
MASTER_KEY (env variable)
    │
    ▼ wraps
Per-User Key (32 bytes, random)
    │
    ▼ encrypts
Vault Entries (passwords)
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn

### 1. Clone and Install

```bash
cd backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"  # MASTER_KEY
```

### 3. Setup Database

```bash
# Run migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# (Optional) Seed test user
npm run db:seed
```

### 4. Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Docker Setup

```bash
# From project root
docker-compose up -d

# Run migrations inside container
docker-compose exec backend npx prisma migrate deploy
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/logout` | Logout (revokes refresh token) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user profile |
| GET | `/api/auth/google` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | Google OAuth callback |
| GET | `/api/auth/github` | Initiate GitHub OAuth |
| GET | `/api/auth/github/callback` | GitHub OAuth callback |

### Passwords (Vault)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/passwords` | List all entries (no passwords) |
| GET | `/api/passwords/:id` | Get entry with decrypted password |
| POST | `/api/passwords` | Create new entry |
| PUT | `/api/passwords/:id` | Update entry |
| DELETE | `/api/passwords/:id` | Delete entry |

## OAuth Setup

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URI:
   - Development: `http://localhost:4000/api/auth/google/callback`
   - Production: `https://your-domain.com/api/auth/google/callback`
7. Copy **Client ID** and **Client Secret** to `.env`

### GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Fill in:
   - Application name: SecurePass
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:4000/api/auth/github/callback`
4. Copy **Client ID** and generate **Client Secret**
5. Add to `.env`

## Frontend Integration

### OAuth Flow

```javascript
// Redirect to OAuth provider
window.location.href = 'http://localhost:4000/api/auth/google';

// After OAuth callback, frontend receives redirect to /oauth-success
// Then fetch user data:
const response = await fetch('http://localhost:4000/api/auth/me', {
  credentials: 'include', // Include cookies
  headers: {
    'Authorization': `Bearer ${accessToken}` // If you have it
  }
});
```

### Token Refresh

```javascript
// When access token expires (401 response)
async function refreshToken() {
  const response = await fetch('http://localhost:4000/api/auth/refresh', {
    method: 'POST',
    credentials: 'include' // Sends httpOnly cookie
  });
  
  if (response.ok) {
    const { accessToken } = await response.json();
    // Store new access token in memory
    return accessToken;
  }
  
  // Refresh failed - redirect to login
  window.location.href = '/login';
}
```

### API Calls with Auth

```javascript
async function fetchPasswords(accessToken) {
  const response = await fetch('http://localhost:4000/api/passwords', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    credentials: 'include'
  });
  
  if (response.status === 401) {
    // Token expired - refresh and retry
    const newToken = await refreshToken();
    return fetchPasswords(newToken);
  }
  
  return response.json();
}
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- encryption.test.ts
```

### Manual Testing with cURL

```bash
# Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"StrongPass123!"}'

# Login (saves cookies)
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"test@example.com","password":"StrongPass123!"}'

# Create password (use access token from login response)
curl -X POST http://localhost:4000/api/passwords \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Gmail","username":"user@gmail.com","password":"secret123","site":"https://gmail.com"}'

# List passwords
curl http://localhost:4000/api/passwords \
  -H "Authorization: Bearer <access_token>"

# Refresh token
curl -X POST http://localhost:4000/api/auth/refresh \
  -b cookies.txt
```

## Security Considerations

### Production Checklist

- [ ] Use strong, unique values for `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `MASTER_KEY`
- [ ] Enable HTTPS (set `secure: true` for cookies)
- [ ] Configure proper CORS origins
- [ ] Use a secrets manager (AWS Secrets Manager, HashiCorp Vault) for `MASTER_KEY`
- [ ] Consider using KMS (AWS KMS, GCP KMS) for key wrapping
- [ ] Enable database encryption at rest
- [ ] Set up proper logging and monitoring
- [ ] Regular security audits

### Key Management

The current implementation stores `MASTER_KEY` in environment variables. For production:

1. **AWS**: Use AWS KMS to wrap/unwrap per-user keys
2. **GCP**: Use Cloud KMS
3. **Self-hosted**: Use HashiCorp Vault

## License

MIT
