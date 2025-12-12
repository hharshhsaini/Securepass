/**
 * Sharing Routes
 * API for secure password sharing
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
    createShareLink,
    accessSharedEntry,
    listShareLinks,
    revokeShareLink
} from '../services/sharingService';
import { logAction } from '../services/auditService';

const router = Router();

/**
 * GET /api/share/:token
 * Access a shared entry (PUBLIC - no auth required)
 */
router.get('/:token', async (req: Request, res: Response): Promise<void> => {
    try {
        const accessorIp = req.ip || req.socket.remoteAddress;
        const entry = await accessSharedEntry(req.params.token, accessorIp);

        if (!entry) {
            res.status(404).json({ error: 'Share link not found or expired' });
            return;
        }

        res.json({ entry });
    } catch (error) {
        res.status(500).json({ error: 'Failed to access shared entry' });
    }
});

// Protected routes below
router.use(requireAuth);

/**
 * GET /api/share
 * List all share links for the user
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const links = await listShareLinks(req.userId!);
        res.json({ links });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch share links' });
    }
});

/**
 * POST /api/share
 * Create a share link
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { entryId, maxViews, expiresInHours, includePassword, includeNotes } = req.body;

        if (!entryId) {
            res.status(400).json({ error: 'entryId is required' });
            return;
        }

        const link = await createShareLink(req.userId!, {
            entryId,
            maxViews,
            expiresInHours,
            includePassword,
            includeNotes
        });

        // Log the share action
        await logAction(req.userId!, {
            action: 'share',
            entryId,
            entryTitle: link.entryTitle,
            ipAddress: req.ip,
            details: { maxViews: link.maxViews, expiresAt: link.expiresAt }
        });

        res.status(201).json({
            link,
            shareUrl: `${process.env.FRONTEND_ORIGIN}/shared.html?token=${link.token}`
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create share link';
        res.status(500).json({ error: message });
    }
});

/**
 * DELETE /api/share/:id
 * Revoke a share link
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
    try {
        const revoked = await revokeShareLink(req.userId!, req.params.id);

        if (!revoked) {
            res.status(404).json({ error: 'Share link not found' });
            return;
        }

        res.json({ message: 'Share link revoked' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to revoke share link' });
    }
});

export default router;
