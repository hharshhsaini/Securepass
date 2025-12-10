/**
 * Password/Vault Routes
 * CRUD operations for encrypted password entries
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPasswordSchema, updatePasswordSchema } from '../utils/validation';
import {
  createVaultEntry,
  listVaultEntries,
  getVaultEntry,
  updateVaultEntry,
  deleteVaultEntry
} from '../services/vaultService';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/passwords
 * List all password entries for the authenticated user
 * Returns list without decrypted passwords (for security)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const entries = await listVaultEntries(req.userId!);
    res.json({ entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch passwords';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/passwords/:id
 * Get a single password entry with decrypted password
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const entry = await getVaultEntry(req.userId!, req.params.id);
    
    if (!entry) {
      res.status(404).json({ error: 'Password entry not found' });
      return;
    }

    res.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch password';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/passwords
 * Create a new password entry
 */
router.post(
  '/',
  validate(createPasswordSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const entry = await createVaultEntry(req.userId!, req.body);
      res.status(201).json({ 
        message: 'Password created successfully',
        entry 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create password';
      res.status(500).json({ error: message });
    }
  }
);

/**
 * PUT /api/passwords/:id
 * Update an existing password entry
 */
router.put(
  '/:id',
  validate(updatePasswordSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const entry = await updateVaultEntry(req.userId!, req.params.id, req.body);
      
      if (!entry) {
        res.status(404).json({ error: 'Password entry not found' });
        return;
      }

      res.json({ 
        message: 'Password updated successfully',
        entry 
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update password';
      res.status(500).json({ error: message });
    }
  }
);

/**
 * DELETE /api/passwords/:id
 * Delete a password entry
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await deleteVaultEntry(req.userId!, req.params.id);
    
    if (!deleted) {
      res.status(404).json({ error: 'Password entry not found' });
      return;
    }

    res.json({ message: 'Password deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete password';
    res.status(500).json({ error: message });
  }
});

export default router;
