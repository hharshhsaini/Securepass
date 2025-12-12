/**
 * Sharing Service
 * Handles secure one-time password sharing via tokenized links
 */

import prisma from '../config/database';
import { hashToken, generateSecureToken } from '../utils/encryption';
import { getVaultEntry } from './vaultService';

export interface ShareLinkInput {
    entryId: string;
    maxViews?: number;
    expiresInHours?: number;
    includePassword?: boolean;
    includeNotes?: boolean;
}

export interface ShareLinkResponse {
    id: string;
    token: string;
    entryId: string;
    entryTitle: string;
    maxViews: number;
    viewCount: number;
    expiresAt: Date;
    includePassword: boolean;
    includeNotes: boolean;
    createdAt: Date;
}

export interface SharedEntryView {
    title: string;
    username: string;
    site: string | null;
    password?: string;
    notes?: string;
}

/**
 * Create a shareable link for an entry
 */
export async function createShareLink(
    userId: string,
    input: ShareLinkInput
): Promise<ShareLinkResponse> {
    // Verify entry belongs to user
    const entry = await prisma.vaultEntry.findFirst({
        where: { id: input.entryId, userId }
    });

    if (!entry) {
        throw new Error('Entry not found');
    }

    // Generate secure token
    const token = generateSecureToken();
    const tokenHash = hashToken(token);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (input.expiresInHours || 24));

    const shareLink = await prisma.sharedLink.create({
        data: {
            userId,
            entryId: input.entryId,
            tokenHash,
            maxViews: input.maxViews || 1,
            expiresAt,
            includePassword: input.includePassword ?? true,
            includeNotes: input.includeNotes ?? false
        }
    });

    return {
        id: shareLink.id,
        token, // Return plain token to user (only time it's visible)
        entryId: entry.id,
        entryTitle: entry.title,
        maxViews: shareLink.maxViews,
        viewCount: shareLink.viewCount,
        expiresAt: shareLink.expiresAt,
        includePassword: shareLink.includePassword,
        includeNotes: shareLink.includeNotes,
        createdAt: shareLink.createdAt
    };
}

/**
 * Access a shared entry via token
 */
export async function accessSharedEntry(
    token: string,
    accessorIp?: string
): Promise<SharedEntryView | null> {
    const tokenHash = hashToken(token);

    const shareLink = await prisma.sharedLink.findFirst({
        where: {
            tokenHash,
            expiresAt: { gt: new Date() }
        },
        include: {
            entry: true
        }
    });

    if (!shareLink) {
        return null;
    }

    // Check if max views reached
    if (shareLink.viewCount >= shareLink.maxViews) {
        return null;
    }

    // Get decrypted entry
    const decryptedEntry = await getVaultEntry(shareLink.userId, shareLink.entryId);

    if (!decryptedEntry) {
        return null;
    }

    // Update view count and access info
    await prisma.sharedLink.update({
        where: { id: shareLink.id },
        data: {
            viewCount: { increment: 1 },
            accessedAt: new Date(),
            accessorIp
        }
    });

    // Return limited view based on settings
    const view: SharedEntryView = {
        title: decryptedEntry.title,
        username: decryptedEntry.username,
        site: decryptedEntry.site
    };

    if (shareLink.includePassword) {
        view.password = decryptedEntry.password;
    }

    if (shareLink.includeNotes) {
        view.notes = decryptedEntry.notes || undefined;
    }

    return view;
}

/**
 * List all share links for a user
 */
export async function listShareLinks(userId: string): Promise<ShareLinkResponse[]> {
    const links = await prisma.sharedLink.findMany({
        where: { userId },
        include: { entry: { select: { title: true } } },
        orderBy: { createdAt: 'desc' }
    });

    return links.map(link => ({
        id: link.id,
        token: '', // Don't expose token after creation
        entryId: link.entryId,
        entryTitle: link.entry.title,
        maxViews: link.maxViews,
        viewCount: link.viewCount,
        expiresAt: link.expiresAt,
        includePassword: link.includePassword,
        includeNotes: link.includeNotes,
        createdAt: link.createdAt
    }));
}

/**
 * Revoke a share link
 */
export async function revokeShareLink(
    userId: string,
    linkId: string
): Promise<boolean> {
    const result = await prisma.sharedLink.deleteMany({
        where: { id: linkId, userId }
    });
    return result.count > 0;
}
