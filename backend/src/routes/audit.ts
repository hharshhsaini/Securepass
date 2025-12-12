/**
 * Audit Log Routes
 * API for viewing security activity
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getAuditLogs, getActivitySummary, AuditAction } from '../services/auditService';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/audit
 * Get audit logs
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { limit, offset, action, startDate, endDate } = req.query;

        const result = await getAuditLogs(req.userId!, {
            limit: limit ? parseInt(limit as string) : undefined,
            offset: offset ? parseInt(offset as string) : undefined,
            action: action as AuditAction | undefined,
            startDate: startDate ? new Date(startDate as string) : undefined,
            endDate: endDate ? new Date(endDate as string) : undefined
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

/**
 * GET /api/audit/summary
 * Get activity summary
 */
router.get('/summary', async (req: Request, res: Response): Promise<void> => {
    try {
        const days = req.query.days ? parseInt(req.query.days as string) : 7;
        const summary = await getActivitySummary(req.userId!, days);
        res.json({ summary, days });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch activity summary' });
    }
});

export default router;
