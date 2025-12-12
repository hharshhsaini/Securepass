/**
 * Collection Service
 * Handles folder/collection management for organizing vault entries
 */

import prisma from '../config/database';

export interface CollectionInput {
    name: string;
    description?: string;
    icon?: string;
    color?: string;
}

export interface CollectionResponse {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    entryCount: number;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Create a new collection
 */
export async function createCollection(
    userId: string,
    input: CollectionInput
): Promise<CollectionResponse> {
    const collection = await prisma.collection.create({
        data: {
            userId,
            name: input.name,
            description: input.description,
            icon: input.icon,
            color: input.color
        },
        include: {
            _count: { select: { entries: true } }
        }
    });

    return formatCollectionResponse(collection);
}

/**
 * List all collections for a user
 */
export async function listCollections(userId: string): Promise<CollectionResponse[]> {
    const collections = await prisma.collection.findMany({
        where: { userId },
        include: {
            _count: { select: { entries: true } }
        },
        orderBy: { name: 'asc' }
    });

    return collections.map(formatCollectionResponse);
}

/**
 * Update a collection
 */
export async function updateCollection(
    userId: string,
    collectionId: string,
    input: Partial<CollectionInput>
): Promise<CollectionResponse | null> {
    const existing = await prisma.collection.findFirst({
        where: { id: collectionId, userId }
    });

    if (!existing) return null;

    const collection = await prisma.collection.update({
        where: { id: collectionId },
        data: {
            name: input.name,
            description: input.description,
            icon: input.icon,
            color: input.color
        },
        include: {
            _count: { select: { entries: true } }
        }
    });

    return formatCollectionResponse(collection);
}

/**
 * Delete a collection (entries moved to uncategorized)
 */
export async function deleteCollection(
    userId: string,
    collectionId: string
): Promise<boolean> {
    const result = await prisma.collection.deleteMany({
        where: { id: collectionId, userId }
    });

    return result.count > 0;
}

/**
 * Move entries to a collection
 */
export async function moveEntriesToCollection(
    userId: string,
    entryIds: string[],
    collectionId: string | null
): Promise<number> {
    // Verify collection belongs to user (if not null)
    if (collectionId) {
        const collection = await prisma.collection.findFirst({
            where: { id: collectionId, userId }
        });
        if (!collection) throw new Error('Collection not found');
    }

    const result = await prisma.vaultEntry.updateMany({
        where: {
            id: { in: entryIds },
            userId
        },
        data: { collectionId }
    });

    return result.count;
}

function formatCollectionResponse(collection: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    color: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { entries: number };
}): CollectionResponse {
    return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        icon: collection.icon,
        color: collection.color,
        entryCount: collection._count.entries,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt
    };
}
