/**
 * Input validation schemas using Zod
 */

import { z } from 'zod';

// Password requirements: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  name: z.string().min(1).max(100).optional()
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

export const createPasswordSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  username: z.string().max(255).optional().or(z.literal('')),
  password: z.string().min(1, 'Password is required'),
  site: z.string().url('Invalid URL').optional().or(z.literal('')),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional()
});

export const updatePasswordSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  username: z.string().max(255).optional().or(z.literal('')),
  password: z.string().min(1).optional(),
  site: z.string().url('Invalid URL').optional().or(z.literal('')).or(z.null()),
  notes: z.string().max(5000).optional().or(z.null())
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePasswordInput = z.infer<typeof createPasswordSchema>;
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
