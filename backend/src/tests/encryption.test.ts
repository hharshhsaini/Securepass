/**
 * Encryption Utilities Tests
 */

import {
  generateUserKey,
  wrapKey,
  unwrapKey,
  encryptVaultValue,
  decryptVaultValue,
  hashToken,
  generateSecureToken
} from '../utils/encryption';

describe('Encryption Utilities', () => {
  // Use a fixed master key for testing
  const masterKey = Buffer.from(process.env.MASTER_KEY!, 'base64');

  describe('generateUserKey', () => {
    it('should generate a 32-byte key', () => {
      const key = generateUserKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should generate unique keys', () => {
      const key1 = generateUserKey();
      const key2 = generateUserKey();
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('wrapKey / unwrapKey', () => {
    it('should wrap and unwrap a key correctly', () => {
      const userKey = generateUserKey();
      const wrapped = wrapKey(userKey, masterKey);
      
      expect(typeof wrapped).toBe('string');
      expect(wrapped.length).toBeGreaterThan(0);

      const unwrapped = unwrapKey(wrapped, masterKey);
      expect(unwrapped.equals(userKey)).toBe(true);
    });

    it('should produce different wrapped values for same key (due to random IV)', () => {
      const userKey = generateUserKey();
      const wrapped1 = wrapKey(userKey, masterKey);
      const wrapped2 = wrapKey(userKey, masterKey);
      
      expect(wrapped1).not.toBe(wrapped2);
    });

    it('should fail to unwrap with wrong master key', () => {
      const userKey = generateUserKey();
      const wrapped = wrapKey(userKey, masterKey);
      const wrongKey = Buffer.alloc(32, 'x');

      expect(() => unwrapKey(wrapped, wrongKey)).toThrow();
    });
  });

  describe('encryptVaultValue / decryptVaultValue', () => {
    it('should encrypt and decrypt a password correctly', () => {
      const userKey = generateUserKey();
      const password = 'MySecretPassword123!';

      const encrypted = encryptVaultValue(password, userKey);
      
      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.tag).toBeTruthy();

      const decrypted = decryptVaultValue(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        userKey
      );

      expect(decrypted).toBe(password);
    });

    it('should handle special characters and unicode', () => {
      const userKey = generateUserKey();
      const password = '🔐 Pässwörd with émojis & spëcial chars!@#$%';

      const encrypted = encryptVaultValue(password, userKey);
      const decrypted = decryptVaultValue(
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.tag,
        userKey
      );

      expect(decrypted).toBe(password);
    });

    it('should fail to decrypt with wrong key', () => {
      const userKey = generateUserKey();
      const wrongKey = generateUserKey();
      const password = 'TestPassword';

      const encrypted = encryptVaultValue(password, userKey);

      expect(() => 
        decryptVaultValue(encrypted.ciphertext, encrypted.iv, encrypted.tag, wrongKey)
      ).toThrow();
    });

    it('should fail to decrypt with tampered ciphertext', () => {
      const userKey = generateUserKey();
      const password = 'TestPassword';

      const encrypted = encryptVaultValue(password, userKey);
      
      // Tamper with ciphertext
      const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
      tamperedCiphertext[0] ^= 0xff;

      expect(() => 
        decryptVaultValue(
          tamperedCiphertext.toString('base64'),
          encrypted.iv,
          encrypted.tag,
          userKey
        )
      ).toThrow();
    });
  });

  describe('hashToken', () => {
    it('should produce consistent hash for same input', () => {
      const token = 'test-token-123';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateSecureToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });
});
