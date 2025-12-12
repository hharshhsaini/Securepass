/**
 * Audit Log Service
 * Tracks user actions for security monitoring
 */

import prisma from '../config/database';

export type AuditAction =
    | 'login'
    | 'logout'
    | 'reveal'
    | 'copy'
    | 'create'
    | 'update'
    | 'delete'
    | 'export'
    | 'import'
    | 'share'
    | 'share_access';

export interface AuditLogInput {
    action: AuditAction;
    entryId?: string;
    entryTitle?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
}

export interface AuditLogResponse {
    id: string;
    action: string;
    entryId: string | null;
    entryTitle: string | null;
    ipAddress: string | null;
    details: Record<string, unknown> | null;
    createdAt: Date;
}

/**
 * Log an action
 */
export async function logAction(
    userId: string,
    input: AuditLogInput
): Promise<void> {
    await prisma.auditLog.create({
        data: {
            userId,
            action: input.action,
            entryId: input.entryId,
            entryTitle: input.entryTitle,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
            details: input.details ? JSON.stringify(input.details) : null
        }
    });
}

/**
 * Get audit logs for a user
 */
export async function getAuditLogs(
    userId: string,
    options: {
        limit?: number;
        offset?: number;
        action?: AuditAction;
        startDate?: Date;
        endDate?: Date;
    } = {}
): Promise<{ logs: AuditLogResponse[]; total: number }> {
    const where: Record<string, unknown> = { userId };

    if (options.action) {
        where.action = options.action;
    }

    if (options.startDate || options.endDate) {
        where.createdAt = {};
        if (options.startDate) {
            (where.createdAt as Record<string, Date>).gte = options.startDate;
        }
        if (options.endDate) {
            (where.createdAt as Record<string, Date>).lte = options.endDate;
        }
    }

    const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: options.limit || 50,
            skip: options.offset || 0
        }),
        prisma.auditLog.count({ where })
    ]);

    return {
        logs: logs.map(log => ({
            id: log.id,
            action: log.action,
            entryId: log.entryId,
            entryTitle: log.entryTitle,
            ipAddress: log.ipAddress,
            details: log.details ? JSON.parse(log.details) : null,
            createdAt: log.createdAt
        })),
        total
    };
}

/**
 * Get recent activity summary
 */
export async function getActivitySummary(
    userId: string,
    days: number = 7
): Promise<Record<string, number>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = await prisma.auditLog.groupBy({
        by: ['action'],
        where: {
            userId,
            createdAt: { gte: startDate }
        },
        _count: { action: true }
    });

    const summary: Record<string, number> = {};
    logs.forEach(log => {
        summary[log.action] = log._count.action;
    });

    return summary;
}
