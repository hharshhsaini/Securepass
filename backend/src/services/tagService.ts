/**
 * Tag Service
 * Handles tag management and filtering
 */

import prisma from '../config/database';

export interface TagInput {
    name: string;
    color?: string;
}

export interface TagResponse {
    id: string;
    name: string;
    color: string | null;
    entryCount: number;
}

/**
 * Create a tag
 */
export async function createTag(userId: string, input: TagInput): Promise<TagResponse> {
    const tag = await prisma.tag.create({
        data: {
            userId,
            name: input.name,
            color: input.color
        },
        include: {
            _count: { select: { entries: true } }
        }
    });

    return formatTagResponse(tag);
}

/**
 * List all tags for a user
 */
export async function listTags(userId: string): Promise<TagResponse[]> {
    const tags = await prisma.tag.findMany({
        where: { userId },
        include: {
            _count: { select: { entries: true } }
        },
        orderBy: { name: 'asc' }
    });

    return tags.map(formatTagResponse);
}

/**
 * Delete a tag
 */
export async function deleteTag(userId: string, tagId: string): Promise<boolean> {
    const result = await prisma.tag.deleteMany({
        where: { id: tagId, userId }
    });
    return result.count > 0;
}

/**
 * Add tags to an entry
 */
export async function addTagsToEntry(
    userId: string,
    entryId: string,
    tagIds: string[]
): Promise<void> {
    // Verify entry belongs to user
    const entry = await prisma.vaultEntry.findFirst({
        where: { id: entryId, userId }
    });
    if (!entry) throw new Error('Entry not found');

    // Verify tags belong to user
    const tags = await prisma.tag.findMany({
        where: { id: { in: tagIds }, userId }
    });

    // Create tag associations
    await prisma.vaultEntryTag.createMany({
        data: tags.map(tag => ({
            entryId,
            tagId: tag.id
        })),
        skipDuplicates: true
    });
}

/**
 * Remove tags from an entry
 */
export async function removeTagsFromEntry(
    userId: string,
    entryId: string,
    tagIds: string[]
): Promise<void> {
    await prisma.vaultEntryTag.deleteMany({
        where: {
            entryId,
            tagId: { in: tagIds },
            entry: { userId }
        }
    });
}

/**
 * Get entries by tag
 */
export async function getEntriesByTag(
    userId: string,
    tagId: string
): Promise<string[]> {
    const entries = await prisma.vaultEntryTag.findMany({
        where: {
            tagId,
            entry: { userId }
        },
        select: { entryId: true }
    });

    return entries.map(e => e.entryId);
}

/**
 * Get or create tag by name
 */
export async function getOrCreateTag(userId: string, name: string): Promise<TagResponse> {
    let tag = await prisma.tag.findFirst({
        where: { userId, name },
        include: { _count: { select: { entries: true } } }
    });

    if (!tag) {
        tag = await prisma.tag.create({
            data: { userId, name },
            include: { _count: { select: { entries: true } } }
        });
    }

    return formatTagResponse(tag);
}

function formatTagResponse(tag: {
    id: string;
    name: string;
    color: string | null;
    _count: { entries: number };
}): TagResponse {
    return {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        entryCount: tag._count.entries
    };
}
