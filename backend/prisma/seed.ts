/**
 * Database Seed Script
 * Creates a test user for development
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Simple key wrapping for seed (matches encryption.ts logic)
function wrapKey(userKey: Buffer, masterKey: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(userKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

async function main() {
  console.log('🌱 Seeding database...');

  // Check for MASTER_KEY
  const masterKeyEnv = process.env.MASTER_KEY;
  if (!masterKeyEnv) {
    console.error('❌ MASTER_KEY environment variable is required');
    console.log('   Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"');
    process.exit(1);
  }

  const masterKey = Buffer.from(masterKeyEnv, 'base64');
  if (masterKey.length !== 32) {
    console.error('❌ MASTER_KEY must be 32 bytes (256 bits)');
    process.exit(1);
  }

  // Create test user
  const testEmail = 'test@example.com';
  const testPassword = 'TestPass123!';

  const existingUser = await prisma.user.findUnique({
    where: { email: testEmail }
  });

  if (existingUser) {
    console.log(`ℹ️  Test user already exists: ${testEmail}`);
  } else {
    const passwordHash = await bcrypt.hash(testPassword, 12);
    const userKey = crypto.randomBytes(32);
    const wrappedKey = wrapKey(userKey, masterKey);

    await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash,
        name: 'Test User',
        wrappedKey
      }
    });

    console.log(`✅ Created test user:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
  }

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
