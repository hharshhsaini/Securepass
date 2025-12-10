/**
 * Authentication Middleware
 * Verifies JWT access tokens and attaches user to request
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokens';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/**
 * Require valid access token
 * Extracts token from Authorization header: "Bearer <token>"
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    const payload = verifyAccessToken(token);

    req.userId = payload.sub;
    req.userEmail = payload.email;

    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Access token expired', code: 'TOKEN_EXPIRED' });
      return;
    }
    
    res.status(401).json({ error: 'Invalid access token' });
  }
}

/**
 * Optional auth - attaches user if token present, but doesn't require it
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      req.userId = payload.sub;
      req.userEmail = payload.email;
    }
  } catch {
    // Token invalid or expired - continue without auth
  }
  
  next();
}
