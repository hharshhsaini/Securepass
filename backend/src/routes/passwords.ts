/**
 * Password/Vault Routes
 * CRUD operations for encrypted password entries
 * Enhanced with search, favorites, bulk operations, and health analysis
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
  deleteVaultEntry,
  toggleFavorite,
  togglePinned,
  bulkDeleteEntries,
  getFullVault,
  importVaultEntries,
  getPasswordHealth
} from '../services/vaultService';
import { logAction } from '../services/auditService';

const router = Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/passwords/health
 * Get password health analysis
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const health = await getPasswordHealth(req.userId!);
    res.json({ health });
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze password health' });
  }
});

/**
 * POST /api/passwords/direct-save
 * Direct save from dashboard (accepts tags)
 */
router.post('/direct-save', async (req: Request, res: Response): Promise<void> => {
  try {
    const entry = await createVaultEntry(req.userId!, req.body);

    await logAction(req.userId!, {
      action: 'create',
      entryId: entry.id,
      entryTitle: entry.title,
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'Saved to vault',
      entry
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save password';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/passwords/export
 * Export all passwords decrypted (for backup)
 */
router.get('/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const entries = await getFullVault(req.userId!);

    await logAction(req.userId!, {
      action: 'export',
      ipAddress: req.ip,
      details: { count: entries.length }
    });

    res.json({ entries });
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

/**
 * POST /api/passwords/import
 * Import passwords from JSON
 */
router.post('/import', async (req: Request, res: Response): Promise<void> => {
  try {
    const { entries } = req.body;
    if (!Array.isArray(entries)) {
      res.status(400).json({ error: 'Invalid format: entries must be an array' });
      return;
    }

    const count = await importVaultEntries(req.userId!, entries);

    await logAction(req.userId!, {
      action: 'import',
      ipAddress: req.ip,
      details: { count }
    });

    res.json({ message: `Successfully imported ${count} entries`, count });
  } catch (error) {
    res.status(500).json({ error: 'Import failed' });
  }
});

/**
 * POST /api/passwords/bulk-delete
 * Delete multiple entries
 */
router.post('/bulk-delete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { entryIds } = req.body;

    if (!Array.isArray(entryIds)) {
      res.status(400).json({ error: 'entryIds must be an array' });
      return;
    }

    const count = await bulkDeleteEntries(req.userId!, entryIds);

    await logAction(req.userId!, {
      action: 'delete',
      ipAddress: req.ip,
      details: { count, bulk: true }
    });

    res.json({ message: `Deleted ${count} entries`, count });
  } catch (error) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

/**
 * GET /api/passwords
 * List all password entries for the authenticated user
 * Supports search and filtering
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, collectionId, tagIds, isFavorite, isPinned, strengthMin, strengthMax } = req.query;

    const entries = await listVaultEntries(req.userId!, {
      query: query as string | undefined,
      collectionId: collectionId as string | undefined,
      tagIds: tagIds ? (tagIds as string).split(',') : undefined,
      isFavorite: isFavorite === 'true' ? true : isFavorite === 'false' ? false : undefined,
      isPinned: isPinned === 'true' ? true : isPinned === 'false' ? false : undefined,
      strengthMin: strengthMin ? parseInt(strengthMin as string) : undefined,
      strengthMax: strengthMax ? parseInt(strengthMax as string) : undefined
    });

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

    await logAction(req.userId!, {
      action: 'reveal',
      entryId: entry.id,
      entryTitle: entry.title,
      ipAddress: req.ip
    });

    res.json({ entry });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch password';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/passwords/:id/favorite
 * Toggle favorite status
 */
router.post('/:id/favorite', async (req: Request, res: Response): Promise<void> => {
  try {
    const isFavorite = await toggleFavorite(req.userId!, req.params.id);
    res.json({ isFavorite });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle favorite';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/passwords/:id/pin
 * Toggle pinned status
 */
router.post('/:id/pin', async (req: Request, res: Response): Promise<void> => {
  try {
    const isPinned = await togglePinned(req.userId!, req.params.id);
    res.json({ isPinned });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to toggle pin';
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

      await logAction(req.userId!, {
        action: 'create',
        entryId: entry.id,
        entryTitle: entry.title,
        ipAddress: req.ip
      });

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

      await logAction(req.userId!, {
        action: 'update',
        entryId: entry.id,
        entryTitle: entry.title,
        ipAddress: req.ip
      });

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
    // Get entry title before deletion for audit log
    const entry = await getVaultEntry(req.userId!, req.params.id);

    const deleted = await deleteVaultEntry(req.userId!, req.params.id);

    if (!deleted) {
      res.status(404).json({ error: 'Password entry not found' });
      return;
    }

    await logAction(req.userId!, {
      action: 'delete',
      entryId: req.params.id,
      entryTitle: entry?.title,
      ipAddress: req.ip
    });

    res.json({ message: 'Password deleted successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete password';
    res.status(500).json({ error: message });
  }
});

export default router;
