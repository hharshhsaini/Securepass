/**
 * Authentication Routes
 * Handles registration, login, logout, token refresh, and OAuth
 */

import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logout,
  getUserById,
  getRefreshCookieOptions,
  AuthTokens,
  UserResponse
} from '../services/authService';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { registerSchema, loginSchema } from '../utils/validation';

const router = Router();

// Cookie name for refresh token
const REFRESH_COOKIE = 'refresh_token';

/**
 * POST /api/auth/register
 * Register a new user with email/password
 */
router.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password, name } = req.body;
      const { user, tokens } = await registerUser(email, password, name);

      // Set refresh token in httpOnly cookie
      setRefreshCookie(res, tokens);

      res.status(201).json({
        message: 'Registration successful',
        user,
        accessToken: tokens.accessToken
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      const status = message.includes('already exists') ? 409 : 500;
      res.status(status).json({ error: message });
    }
  }
);

/**
 * POST /api/auth/login
 * Login with email/password
 */
router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      const { user, tokens } = await loginUser(email, password);

      setRefreshCookie(res, tokens);

      res.json({
        message: 'Login successful',
        user,
        accessToken: tokens.accessToken
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      res.status(401).json({ error: message });
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout - clears refresh cookie and revokes token
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    
    if (refreshToken) {
      await logout(refreshToken);
    }

    // Clear the cookie
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    // Still clear cookie even if DB operation fails
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.json({ message: 'Logged out' });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using httpOnly cookie
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    
    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token not found' });
      return;
    }

    const { accessToken, user } = await refreshAccessToken(refreshToken);

    res.json({
      accessToken,
      user
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    res.status(401).json({ error: message });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile (requires access token)
 */
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getUserById(req.userId!);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * GET /api/auth/google
 * Initiate Google OAuth flow
 * Frontend should redirect user to this endpoint
 */
router.get(
  '/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })
);

/**
 * GET /api/auth/google/callback
 * Google OAuth callback - handles response from Google
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_ORIGIN || ''}/login?error=oauth_failed`
  }),
  handleOAuthCallback
);

/**
 * GET /api/auth/github
 * Initiate GitHub OAuth flow
 */
router.get(
  '/github',
  passport.authenticate('github', { 
    scope: ['user:email'],
    session: false 
  })
);

/**
 * GET /api/auth/github/callback
 * GitHub OAuth callback
 */
router.get(
  '/github/callback',
  passport.authenticate('github', { 
    session: false,
    failureRedirect: `${process.env.FRONTEND_ORIGIN || ''}/login?error=oauth_failed`
  }),
  handleOAuthCallback
);

/**
 * Handle OAuth callback - set cookie and redirect to frontend
 */
function handleOAuthCallback(req: Request, res: Response): void {
  try {
    // req.user contains { user, tokens } from passport strategy
    const authResult = req.user as { user: UserResponse; tokens: AuthTokens };
    
    if (!authResult || !authResult.tokens) {
      res.redirect(`${process.env.FRONTEND_ORIGIN || ''}/login?error=oauth_failed`);
      return;
    }

    // Set refresh token in httpOnly cookie
    setRefreshCookie(res, authResult.tokens);

    // Redirect to frontend success page
    // Frontend will call /api/auth/me to get user info
    const redirectUrl = process.env.OAUTH_SUCCESS_REDIRECT || 
      `${process.env.FRONTEND_ORIGIN || ''}/oauth-success`;
    
    res.redirect(redirectUrl);
  } catch (error) {
    res.redirect(`${process.env.FRONTEND_ORIGIN || ''}/login?error=oauth_failed`);
  }
}

/**
 * Helper to set refresh token cookie
 */
function setRefreshCookie(res: Response, tokens: AuthTokens): void {
  const cookieOptions = getRefreshCookieOptions(tokens.refreshTokenExpiresAt);
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, cookieOptions);
}

export default router;
