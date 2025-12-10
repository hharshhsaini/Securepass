/**
 * JWT Token utilities
 * 
 * Access Token: Short-lived (15m), sent in response body, stored in memory/localStorage
 * Refresh Token: Long-lived (30d), stored in httpOnly Secure cookie
 */

import jwt from 'jsonwebtoken';
import { hashToken, generateSecureToken } from './encryption';

export interface AccessTokenPayload {
  sub: string; // user ID
  email?: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string; // links to DB record for revocation
  type: 'refresh';
}

/**
 * Generate an access token (short-lived)
 */
export function generateAccessToken(userId: string, email?: string): string {
  const payload: AccessTokenPayload = {
    sub: userId,
    email,
    type: 'access'
  };
  
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
  
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn']
  });
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as AccessTokenPayload;
  
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  
  return payload;
}

/**
 * Generate a refresh token
 * Returns both the raw token (for cookie) and data for DB storage
 */
export function generateRefreshToken(userId: string): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  
  // Parse expiry from env (e.g., "30d" -> 30 days)
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  const days = parseInt(expiresIn.replace('d', ''), 10) || 30;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  
  return { token, tokenHash, expiresAt };
}

/**
 * Get refresh token cookie options
 */
export function getRefreshCookieOptions(expiresAt: Date) {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    httpOnly: true,
    secure: isProduction, // HTTPS only in production
    sameSite: 'lax' as const, // Allows OAuth redirects
    path: '/api/auth', // Only sent to auth endpoints
    expires: expiresAt
  };
}

/**
 * Parse duration string to milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // default 15 minutes
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}
