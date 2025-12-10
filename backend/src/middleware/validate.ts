/**
 * Validation Middleware
 * Uses Zod schemas to validate request bodies
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Create validation middleware for a Zod schema
 */
export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }));
        
        res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
        return;
      }
      
      res.status(400).json({ error: 'Invalid request body' });
    }
  };
}
