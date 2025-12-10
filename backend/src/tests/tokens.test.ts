/**
 * Token Utilities Tests
 */

import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  parseDuration
} from '../utils/tokens';

describe('Token Utilities', () => {
  describe('generateAccessToken / verifyAccessToken', () => {
    it('should generate and verify a valid access token', () => {
      const userId = 'test-user-id';
      const email = 'test@example.com';

      const token = generateAccessToken(userId, email);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format

      const payload = verifyAccessToken(token);
      expect(payload.sub).toBe(userId);
      expect(payload.email).toBe(email);
      expect(payload.type).toBe('access');
    });

    it('should work without email', () => {
      const userId = 'test-user-id';
      const token = generateAccessToken(userId);
      const payload = verifyAccessToken(token);
      
      expect(payload.sub).toBe(userId);
      expect(payload.email).toBeUndefined();
    });

    it('should throw on invalid token', () => {
      expect(() => verifyAccessToken('invalid-token')).toThrow();
    });

    it('should throw on tampered token', () => {
      const token = generateAccessToken('user-id');
      const tampered = token.slice(0, -5) + 'xxxxx';
      
      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token data', () => {
      const userId = 'test-user-id';
      const result = generateRefreshToken(userId);

      expect(result.token).toBeTruthy();
      expect(result.tokenHash).toBeTruthy();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should generate unique tokens', () => {
      const result1 = generateRefreshToken('user-1');
      const result2 = generateRefreshToken('user-1');

      expect(result1.token).not.toBe(result2.token);
      expect(result1.tokenHash).not.toBe(result2.tokenHash);
    });
  });

  describe('parseDuration', () => {
    it('should parse seconds', () => {
      expect(parseDuration('30s')).toBe(30 * 1000);
    });

    it('should parse minutes', () => {
      expect(parseDuration('15m')).toBe(15 * 60 * 1000);
    });

    it('should parse hours', () => {
      expect(parseDuration('2h')).toBe(2 * 60 * 60 * 1000);
    });

    it('should parse days', () => {
      expect(parseDuration('30d')).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should return default for invalid format', () => {
      expect(parseDuration('invalid')).toBe(15 * 60 * 1000);
    });
  });
});
