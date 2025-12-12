/**
 * Vault Service
 * Handles CRUD operations for encrypted password entries
 * Enhanced with search, filtering, favorites, and health analysis
 */

import prisma from '../config/database';
import {
  getMasterKey,
  unwrapKey,
  encryptVaultValue,
  decryptVaultValue
} from '../utils/encryption';
import type { VaultEntry } from '@prisma/client';

export interface VaultEntryInput {
  title: string;
  username?: string;
  password: string;
  site?: string | null;
  notes?: string | null;
  tags?: string[];
  collectionId?: string | null;
  isFavorite?: boolean;
  isPinned?: boolean;
}

export interface VaultEntryResponse {
  id: string;
  title: string;
  username: string;
  password: string; // decrypted
  site: string | null;
  notes: string | null;
  collectionId: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  strength: number | null;
  tags: { id: string; name: string; color: string | null }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultEntryListItem {
  id: string;
  title: string;
  username: string;
  site: string | null;
  collectionId: string | null;
  isFavorite: boolean;
  isPinned: boolean;
  strength: number | null;
  tags: { id: string; name: string; color: string | null }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultSearchOptions {
  query?: string;
  collectionId?: string | null;
  tagIds?: string[];
  isFavorite?: boolean;
  isPinned?: boolean;
  strengthMin?: number;
  strengthMax?: number;
}

export interface PasswordHealth {
  total: number;
  strong: number;
  medium: number;
  weak: number;
  reused: number;
  old: number; // older than 90 days
  noPassword: number;
}

/**
 * Get user's decryption key
 */
async function getUserKey(userId: string): Promise<Buffer> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { wrappedKey: true }
  });

  if (!user?.wrappedKey) {
    throw new Error('User encryption key not found');
  }

  const masterKey = getMasterKey();
  return unwrapKey(user.wrappedKey, masterKey);
}

/**
 * Calculate password strength (0-4)
 */
function calculateStrength(password: string): number {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  return Math.min(score, 4);
}

/**
 * Create a new vault entry
 */
export async function createVaultEntry(
  userId: string,
  input: VaultEntryInput
): Promise<VaultEntryResponse> {
  const userKey = await getUserKey(userId);

  // Encrypt the password
  const { ciphertext, iv, tag } = encryptVaultValue(input.password, userKey);

  // Calculate strength
  const strength = calculateStrength(input.password);

  // Handle tags by appending to notes
  let notes = input.notes || null;
  if (input.tags && input.tags.length > 0) {
    const tagString = `Tags: ${input.tags.join(', ')}`;
    notes = notes ? `${notes}\n\n${tagString}` : tagString;
  }

  const entry = await prisma.vaultEntry.create({
    data: {
      userId,
      title: input.title,
      username: input.username || "",
      site: input.site || null,
      notes,
      passwordCiphertext: ciphertext,
      iv,
      tag,
      collectionId: input.collectionId || null,
      isFavorite: input.isFavorite || false,
      isPinned: input.isPinned || false,
      strength
    },
    include: {
      tags: { include: { tag: true } }
    }
  });

  return formatEntryResponse(entry, input.password);
}

/**
 * Get all vault entries for a user (list view - no passwords)
 */
export async function listVaultEntries(
  userId: string,
  options: VaultSearchOptions = {}
): Promise<VaultEntryListItem[]> {
  const where: Record<string, unknown> = { userId };

  // Collection filter
  if (options.collectionId !== undefined) {
    where.collectionId = options.collectionId;
  }

  // Favorite filter
  if (options.isFavorite !== undefined) {
    where.isFavorite = options.isFavorite;
  }

  // Pinned filter
  if (options.isPinned !== undefined) {
    where.isPinned = options.isPinned;
  }

  // Strength filter
  if (options.strengthMin !== undefined || options.strengthMax !== undefined) {
    where.strength = {};
    if (options.strengthMin !== undefined) {
      (where.strength as Record<string, number>).gte = options.strengthMin;
    }
    if (options.strengthMax !== undefined) {
      (where.strength as Record<string, number>).lte = options.strengthMax;
    }
  }

  // Text search
  if (options.query) {
    const q = options.query;
    where.OR = [
      { title: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } },
      { site: { contains: q, mode: 'insensitive' } },
      { notes: { contains: q, mode: 'insensitive' } }
    ];
  }

  // Tag filter
  if (options.tagIds && options.tagIds.length > 0) {
    where.tags = {
      some: { tagId: { in: options.tagIds } }
    };
  }

  const entries = await prisma.vaultEntry.findMany({
    where,
    orderBy: [
      { isPinned: 'desc' },
      { isFavorite: 'desc' },
      { updatedAt: 'desc' }
    ],
    select: {
      id: true,
      title: true,
      username: true,
      site: true,
      collectionId: true,
      isFavorite: true,
      isPinned: true,
      strength: true,
      createdAt: true,
      updatedAt: true,
      tags: {
        include: { tag: true }
      }
    }
  });

  return entries.map(entry => ({
    id: entry.id,
    title: entry.title,
    username: entry.username,
    site: entry.site,
    collectionId: entry.collectionId,
    isFavorite: entry.isFavorite,
    isPinned: entry.isPinned,
    strength: entry.strength,
    tags: entry.tags.map(t => ({
      id: t.tag.id,
      name: t.tag.name,
      color: t.tag.color
    })),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  }));
}

/**
 * Get a single vault entry with decrypted password
 */
export async function getVaultEntry(
  userId: string,
  entryId: string
): Promise<VaultEntryResponse | null> {
  const entry = await prisma.vaultEntry.findFirst({
    where: {
      id: entryId,
      userId
    },
    include: {
      tags: { include: { tag: true } }
    }
  });

  if (!entry) {
    return null;
  }

  const userKey = await getUserKey(userId);
  const password = decryptVaultValue(
    entry.passwordCiphertext,
    entry.iv,
    entry.tag,
    userKey
  );

  // Update lastUsedAt
  await prisma.vaultEntry.update({
    where: { id: entryId },
    data: { lastUsedAt: new Date() }
  });

  return formatEntryResponse(entry, password);
}

/**
 * Update a vault entry
 */
export async function updateVaultEntry(
  userId: string,
  entryId: string,
  input: Partial<VaultEntryInput>
): Promise<VaultEntryResponse | null> {
  const existing = await prisma.vaultEntry.findFirst({
    where: { id: entryId, userId }
  });

  if (!existing) {
    return null;
  }

  const userKey = await getUserKey(userId);
  const updateData: Record<string, unknown> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.username !== undefined) updateData.username = input.username;
  if (input.site !== undefined) updateData.site = input.site || null;
  if (input.notes !== undefined) updateData.notes = input.notes || null;
  if (input.collectionId !== undefined) updateData.collectionId = input.collectionId;
  if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;
  if (input.isPinned !== undefined) updateData.isPinned = input.isPinned;

  // If password is being updated, re-encrypt
  if (input.password !== undefined) {
    const { ciphertext, iv, tag } = encryptVaultValue(input.password, userKey);
    updateData.passwordCiphertext = ciphertext;
    updateData.iv = iv;
    updateData.tag = tag;
    updateData.strength = calculateStrength(input.password);
  }

  const entry = await prisma.vaultEntry.update({
    where: { id: entryId },
    data: updateData,
    include: {
      tags: { include: { tag: true } }
    }
  });

  // Decrypt password for response
  const password = decryptVaultValue(
    entry.passwordCiphertext,
    entry.iv,
    entry.tag,
    userKey
  );

  return formatEntryResponse(entry, password);
}

/**
 * Toggle favorite status
 */
export async function toggleFavorite(
  userId: string,
  entryId: string
): Promise<boolean> {
  const entry = await prisma.vaultEntry.findFirst({
    where: { id: entryId, userId }
  });

  if (!entry) throw new Error('Entry not found');

  await prisma.vaultEntry.update({
    where: { id: entryId },
    data: { isFavorite: !entry.isFavorite }
  });

  return !entry.isFavorite;
}

/**
 * Toggle pinned status
 */
export async function togglePinned(
  userId: string,
  entryId: string
): Promise<boolean> {
  const entry = await prisma.vaultEntry.findFirst({
    where: { id: entryId, userId }
  });

  if (!entry) throw new Error('Entry not found');

  await prisma.vaultEntry.update({
    where: { id: entryId },
    data: { isPinned: !entry.isPinned }
  });

  return !entry.isPinned;
}

/**
 * Delete a vault entry
 */
export async function deleteVaultEntry(
  userId: string,
  entryId: string
): Promise<boolean> {
  const result = await prisma.vaultEntry.deleteMany({
    where: {
      id: entryId,
      userId
    }
  });

  return result.count > 0;
}

/**
 * Bulk delete entries
 */
export async function bulkDeleteEntries(
  userId: string,
  entryIds: string[]
): Promise<number> {
  const result = await prisma.vaultEntry.deleteMany({
    where: {
      id: { in: entryIds },
      userId
    }
  });

  return result.count;
}

/**
 * Get password health analysis
 */
export async function getPasswordHealth(userId: string): Promise<PasswordHealth> {
  const userKey = await getUserKey(userId);

  const entries = await prisma.vaultEntry.findMany({
    where: { userId },
    select: {
      passwordCiphertext: true,
      iv: true,
      tag: true,
      strength: true,
      createdAt: true
    }
  });

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Decrypt and analyze
  const passwordHashes = new Map<string, number>();
  let strong = 0, medium = 0, weak = 0, old = 0, noPassword = 0;

  for (const entry of entries) {
    try {
      const password = decryptVaultValue(
        entry.passwordCiphertext,
        entry.iv,
        entry.tag,
        userKey
      );

      if (!password) {
        noPassword++;
        continue;
      }

      // Track reuse (simple hash for comparison)
      const hash = Buffer.from(password).toString('base64');
      passwordHashes.set(hash, (passwordHashes.get(hash) || 0) + 1);

      // Strength analysis
      const strength = entry.strength ?? calculateStrength(password);
      if (strength >= 4) strong++;
      else if (strength >= 2) medium++;
      else weak++;

      // Age analysis
      if (entry.createdAt < ninetyDaysAgo) old++;
    } catch (e) {
      noPassword++;
    }
  }

  // Count reused passwords
  let reused = 0;
  passwordHashes.forEach(count => {
    if (count > 1) reused += count;
  });

  return {
    total: entries.length,
    strong,
    medium,
    weak,
    reused,
    old,
    noPassword
  };
}

/**
 * Get all vault entries with DECRYPTED passwords (for export)
 */
export async function getFullVault(userId: string): Promise<VaultEntryResponse[]> {
  const entries = await prisma.vaultEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      tags: { include: { tag: true } }
    }
  });

  const userKey = await getUserKey(userId);

  return entries.map(entry => {
    try {
      const password = decryptVaultValue(
        entry.passwordCiphertext,
        entry.iv,
        entry.tag,
        userKey
      );
      return formatEntryResponse(entry, password);
    } catch (e) {
      return formatEntryResponse(entry, "");
    }
  });
}

/**
 * Import vault entries
 */
export async function importVaultEntries(
  userId: string,
  entries: VaultEntryInput[]
): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    try {
      await createVaultEntry(userId, entry);
      count++;
    } catch (e) {
      console.error('Import failed for entry', entry.title, e);
    }
  }
  return count;
}

/**
 * Format entry for API response
 */
function formatEntryResponse(
  entry: VaultEntry & { tags: { tag: { id: string; name: string; color: string | null } }[] },
  decryptedPassword: string
): VaultEntryResponse {
  return {
    id: entry.id,
    title: entry.title,
    username: entry.username,
    password: decryptedPassword,
    site: entry.site,
    notes: entry.notes,
    collectionId: entry.collectionId,
    isFavorite: entry.isFavorite,
    isPinned: entry.isPinned,
    strength: entry.strength,
    tags: entry.tags.map(t => ({
      id: t.tag.id,
      name: t.tag.name,
      color: t.tag.color
    })),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}
