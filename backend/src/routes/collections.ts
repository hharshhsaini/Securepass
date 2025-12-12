/**
 * Collections Routes
 * API for folder/collection management
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
    createCollection,
    listCollections,
    updateCollection,
    deleteCollection,
    moveEntriesToCollection
} from '../services/collectionService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/collections
 * List all collections
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const collections = await listCollections(req.userId!);
        res.json({ collections });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch collections' });
    }
});

/**
 * POST /api/collections
 * Create a new collection
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, description, icon, color } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }

        const collection = await createCollection(req.userId!, {
            name,
            description,
            icon,
            color
        });

        res.status(201).json({ collection });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create collection' });
    }
});

/**
 * PUT /api/collections/:id
 * Update a collection
 */
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const collection = await updateCollection(
            req.userId!,
            req.params.id,
            req.body
        );

        if (!collection) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }

        res.json({ collection });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update collection' });
    }
});

/**
 * DELETE /api/collections/:id
 * Delete a collection
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const deleted = await deleteCollection(req.userId!, req.params.id);

        if (!deleted) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }

        res.json({ message: 'Collection deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});

/**
 * POST /api/collections/:id/entries
 * Move entries to a collection
 */
router.post('/:id/entries', async (req: Request, res: Response): Promise<void> => {
    try {
        const { entryIds } = req.body;

        if (!Array.isArray(entryIds)) {
            res.status(400).json({ error: 'entryIds must be an array' });
            return;
        }

        const collectionId = req.params.id === 'null' ? null : req.params.id;
        const count = await moveEntriesToCollection(req.userId!, entryIds, collectionId);

        res.json({ message: `Moved ${count} entries`, count });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to move entries';
        res.status(500).json({ error: message });
    }
});

export default router;
