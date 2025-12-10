/**
 * Encryption utilities for SecurePass
 * 
 * Uses AES-256-GCM for all encryption operations.
 * 
 * Key Hierarchy:
 * 1. MASTER_KEY (server env) - Used to wrap/unwrap per-user keys
 * 2. Per-user key (32 bytes) - Generated on user creation, wrapped with MASTER_KEY
 * 3. Vault entries encrypted with unwrapped per-user key
 * 
 * This design allows:
 * - Each user has unique encryption key
 * - Server can decrypt when needed (for API responses)
 * - MASTER_KEY rotation possible by re-wrapping all user keys
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits auth tag
const KEY_LENGTH = 32; // 256 bits

/**
 * Get the master key from environment
 * In production, use KMS (AWS KMS, GCP KMS) instead
 */
export function getMasterKey(): Buffer {
  const masterKeyEnv = process.env.MASTER_KEY;
  if (!masterKeyEnv) {
    throw new Error('MASTER_KEY environment variable is not set');
  }
  
  const key = Buffer.from(masterKeyEnv, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new Error(`MASTER_KEY must be ${KEY_LENGTH} bytes (256 bits)`);
  }
  
  return key;
}

/**
 * Generate a new random per-user encryption key
 */
export function generateUserKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

/**
 * Wrap (encrypt) a per-user key with the server MASTER_KEY
 * Output format: base64(iv || authTag || ciphertext)
 */
export function wrapKey(userKey: Buffer, masterKey: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  
  const ciphertext = Buffer.concat([
    cipher.update(userKey),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  
  // Concatenate: iv (12) + tag (16) + ciphertext (32) = 60 bytes
  const wrapped = Buffer.concat([iv, tag, ciphertext]);
  return wrapped.toString('base64');
}

/**
 * Unwrap (decrypt) a per-user key using the server MASTER_KEY
 */
export function unwrapKey(wrappedB64: string, masterKey: Buffer): Buffer {
  const data = Buffer.from(wrappedB64, 'base64');
  
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(tag);
  
  const userKey = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);
  
  return userKey;
}

/**
 * Encrypt a vault entry value (password) using the user's key
 * Returns separate ciphertext, iv, and tag for storage
 */
export function encryptVaultValue(
  plaintext: string,
  userKey: Buffer
): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, userKey, iv);
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

/**
 * Decrypt a vault entry value using the user's key
 */
export function decryptVaultValue(
  ciphertextB64: string,
  ivB64: string,
  tagB64: string,
  userKey: Buffer
): string {
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, userKey, iv);
  decipher.setAuthTag(tag);
  
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]).toString('utf8');
  
  return plaintext;
}

/**
 * Hash a refresh token for storage (we don't store raw tokens)
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
