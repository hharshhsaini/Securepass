/**
 * Tags Routes
 * API for tag management
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
    createTag,
    listTags,
    deleteTag,
    addTagsToEntry,
    removeTagsFromEntry
} from '../services/tagService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/tags
 * List all tags
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const tags = await listTags(req.userId!);
        res.json({ tags });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch tags' });
    }
});

/**
 * POST /api/tags
 * Create a new tag
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, color } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Name is required' });
            return;
        }

        const tag = await createTag(req.userId!, { name, color });
        res.status(201).json({ tag });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create tag' });
    }
});

/**
 * DELETE /api/tags/:id
 * Delete a tag
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const deleted = await deleteTag(req.userId!, req.params.id);

        if (!deleted) {
            res.status(404).json({ error: 'Tag not found' });
            return;
        }

        res.json({ message: 'Tag deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete tag' });
    }
});

/**
 * POST /api/tags/entries/:entryId
 * Add tags to an entry
 */
router.post('/entries/:entryId', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tagIds } = req.body;

        if (!Array.isArray(tagIds)) {
            res.status(400).json({ error: 'tagIds must be an array' });
            return;
        }

        await addTagsToEntry(req.userId!, req.params.entryId, tagIds);
        res.json({ message: 'Tags added' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to add tags';
        res.status(500).json({ error: message });
    }
});

/**
 * DELETE /api/tags/entries/:entryId
 * Remove tags from an entry
 */
router.delete('/entries/:entryId', async (req: Request, res: Response): Promise<void> => {
    try {
        const { tagIds } = req.body;

        if (!Array.isArray(tagIds)) {
            res.status(400).json({ error: 'tagIds must be an array' });
            return;
        }

        await removeTagsFromEntry(req.userId!, req.params.entryId, tagIds);
        res.json({ message: 'Tags removed' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove tags' });
    }
});

export default router;
