/**
 * Authentication Service
 * Handles user registration, login, token management, and OAuth
 */

import bcrypt from 'bcrypt';
import prisma from '../config/database';
import {
  generateUserKey,
  wrapKey,
  getMasterKey,
  hashToken
} from '../utils/encryption';
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshCookieOptions
} from '../utils/tokens';
import type { User } from '@prisma/client';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface UserResponse {
  id: string;
  email: string | null;
  name: string | null;
  hasVaultKey: boolean;
  createdAt: Date;
}

/**
 * Register a new user with email/password
 */
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<{ user: UserResponse; tokens: AuthTokens }> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Generate and wrap per-user encryption key
  const userKey = generateUserKey();
  const masterKey = getMasterKey();
  const wrappedKey = wrapKey(userKey, masterKey);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      wrappedKey
    }
  });

  // Generate tokens
  const tokens = await createTokensForUser(user);

  return {
    user: formatUserResponse(user),
    tokens
  };
}

/**
 * Login with email/password
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ user: UserResponse; tokens: AuthTokens }> {
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user || !user.passwordHash) {
    throw new Error('Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  const tokens = await createTokensForUser(user);

  return {
    user: formatUserResponse(user),
    tokens
  };
}

/**
 * Find or create user from OAuth provider
 */
export async function findOrCreateOAuthUser(
  provider: 'google' | 'github',
  providerId: string,
  email: string | null,
  name: string | null,
  accessToken?: string,
  refreshToken?: string
): Promise<{ user: UserResponse; tokens: AuthTokens }> {
  // First, check if OAuth provider link exists
  let oauthProvider = await prisma.oAuthProvider.findUnique({
    where: {
      provider_providerId: { provider, providerId }
    },
    include: { user: true }
  });

  let user: User;

  if (oauthProvider) {
    // Existing OAuth user - update tokens if provided
    user = oauthProvider.user;
    
    if (accessToken || refreshToken) {
      await prisma.oAuthProvider.update({
        where: { id: oauthProvider.id },
        data: { accessToken, refreshToken }
      });
    }
  } else {
    // New OAuth login
    // Check if user with same email exists (link accounts)
    let existingUser = email 
      ? await prisma.user.findUnique({ where: { email } })
      : null;

    if (existingUser) {
      // Link OAuth to existing account
      user = existingUser;
      
      // Ensure user has a wrapped key
      if (!user.wrappedKey) {
        const userKey = generateUserKey();
        const masterKey = getMasterKey();
        const wrappedKey = wrapKey(userKey, masterKey);
        
        user = await prisma.user.update({
          where: { id: user.id },
          data: { wrappedKey }
        });
      }
    } else {
      // Create new user
      const userKey = generateUserKey();
      const masterKey = getMasterKey();
      const wrappedKey = wrapKey(userKey, masterKey);

      user = await prisma.user.create({
        data: {
          email,
          name,
          wrappedKey
        }
      });
    }

    // Create OAuth provider link
    await prisma.oAuthProvider.create({
      data: {
        provider,
        providerId,
        accessToken,
        refreshToken,
        userId: user.id
      }
    });
  }

  const tokens = await createTokensForUser(user);

  return {
    user: formatUserResponse(user),
    tokens
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshTokenValue: string
): Promise<{ accessToken: string; user: UserResponse }> {
  const tokenHash = hashToken(refreshTokenValue);

  const refreshToken = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      revoked: false,
      expiresAt: { gt: new Date() }
    },
    include: { user: true }
  });

  if (!refreshToken) {
    throw new Error('Invalid or expired refresh token');
  }

  const accessToken = generateAccessToken(
    refreshToken.user.id,
    refreshToken.user.email || undefined
  );

  return {
    accessToken,
    user: formatUserResponse(refreshToken.user)
  };
}

/**
 * Logout - revoke refresh token
 */
export async function logout(refreshTokenValue: string): Promise<void> {
  const tokenHash = hashToken(refreshTokenValue);

  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: { revoked: true }
  });
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId },
    data: { revoked: true }
  });
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<UserResponse | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ? formatUserResponse(user) : null;
}

/**
 * Create access and refresh tokens for a user
 */
async function createTokensForUser(user: User): Promise<AuthTokens> {
  const accessToken = generateAccessToken(user.id, user.email || undefined);
  const { token: refreshToken, tokenHash, expiresAt } = generateRefreshToken(user.id);

  // Store refresh token hash in DB
  await prisma.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt
    }
  });

  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: expiresAt
  };
}

/**
 * Format user for API response
 */
function formatUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    hasVaultKey: !!user.wrappedKey,
    createdAt: user.createdAt
  };
}

export { getRefreshCookieOptions };
