/**
 * Vault Service
 * Handles CRUD operations for encrypted password entries
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
  username: string;
  password: string;
  site?: string | null;
  notes?: string | null;
}

export interface VaultEntryResponse {
  id: string;
  title: string;
  username: string;
  password: string; // decrypted
  site: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultEntryListItem {
  id: string;
  title: string;
  username: string;
  site: string | null;
  createdAt: Date;
  updatedAt: Date;
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
 * Create a new vault entry
 */
export async function createVaultEntry(
  userId: string,
  input: VaultEntryInput
): Promise<VaultEntryResponse> {
  const userKey = await getUserKey(userId);
  
  // Encrypt the password
  const { ciphertext, iv, tag } = encryptVaultValue(input.password, userKey);

  const entry = await prisma.vaultEntry.create({
    data: {
      userId,
      title: input.title,
      username: input.username,
      site: input.site || null,
      notes: input.notes || null,
      passwordCiphertext: ciphertext,
      iv,
      tag
    }
  });

  return formatEntryResponse(entry, input.password);
}

/**
 * Get all vault entries for a user (list view - no passwords)
 */
export async function listVaultEntries(userId: string): Promise<VaultEntryListItem[]> {
  const entries = await prisma.vaultEntry.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      username: true,
      site: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return entries;
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
      userId // Ensure user owns this entry
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
  // Verify ownership
  const existing = await prisma.vaultEntry.findFirst({
    where: { id: entryId, userId }
  });

  if (!existing) {
    return null;
  }

  const userKey = await getUserKey(userId);
  
  // Prepare update data
  const updateData: Record<string, unknown> = {};
  
  if (input.title !== undefined) updateData.title = input.title;
  if (input.username !== undefined) updateData.username = input.username;
  if (input.site !== undefined) updateData.site = input.site || null;
  if (input.notes !== undefined) updateData.notes = input.notes || null;
  
  // If password is being updated, re-encrypt
  if (input.password !== undefined) {
    const { ciphertext, iv, tag } = encryptVaultValue(input.password, userKey);
    updateData.passwordCiphertext = ciphertext;
    updateData.iv = iv;
    updateData.tag = tag;
  }

  const entry = await prisma.vaultEntry.update({
    where: { id: entryId },
    data: updateData
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
 * Delete a vault entry
 */
export async function deleteVaultEntry(
  userId: string,
  entryId: string
): Promise<boolean> {
  const result = await prisma.vaultEntry.deleteMany({
    where: {
      id: entryId,
      userId // Ensure user owns this entry
    }
  });

  return result.count > 0;
}

/**
 * Format entry for API response
 */
function formatEntryResponse(
  entry: VaultEntry,
  decryptedPassword: string
): VaultEntryResponse {
  return {
    id: entry.id,
    title: entry.title,
    username: entry.username,
    password: decryptedPassword,
    site: entry.site,
    notes: entry.notes,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}
