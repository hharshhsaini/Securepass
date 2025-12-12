import request from 'supertest';
import app from '../server';
import prisma from '../config/database';

describe('Acceptance Tests', () => {
    let accessToken: string;
    let userId: string;
    let refreshToken: string; // To simulate OAuth cookie
    const testEmail = `accept_${Date.now()}@example.com`;
    const weakPassword = 'weak';
    const strongPassword = 'StrongPassword123!@#';

    beforeAll(async () => {
        // Ensure clean state handled by afterAll
    });

    afterAll(async () => {
        // Cleanup
        await prisma.user.deleteMany({
            where: { email: { contains: 'accept_' } }
        });
        await prisma.$disconnect();
    });

    // 1. Full Flow: Register -> Login -> Generate -> Save -> List -> Reveal
    describe('1. Full User Journey', () => {
        it('should register a new user', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: testEmail,
                    password: 'Password123!',
                    name: 'Acceptance User'
                });

            expect(res.status).toBe(201);
            accessToken = res.body.accessToken;
            userId = res.body.user.id;

            // Capture refresh token for OAuth test later
            const cookies = res.headers['set-cookie'] as unknown as string[];
            const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token'));
            expect(refreshCookie).toBeDefined();
            refreshToken = refreshCookie!.split(';')[0];
        });

        it('should login (if not already logged in by register)', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: testEmail,
                    password: 'Password123!'
                });
            expect(res.status).toBe(200);
            accessToken = res.body.accessToken;
        });

        it('should save a generated password (with strength)', async () => {
            const res = await request(app)
                .post('/api/passwords') // Standard endpoint used by dashboard
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    title: 'Generated One',
                    password: strongPassword,
                    strength: 5,
                    tags: ['generated']
                });

            expect(res.status).toBe(201);
            expect(res.body.entry.strength).toBe(4);
        });

        it('should list passwords and see metadata only', async () => {
            const res = await request(app)
                .get('/api/passwords')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            const entry = res.body.entries[0];
            expect(entry.title).toBe('Generated One');
            expect(entry.password).toBeUndefined(); // Important: Metadata only
        });

        it('should reveal full password by ID', async () => {
            // Get ID first
            const listRes = await request(app)
                .get('/api/passwords')
                .set('Authorization', `Bearer ${accessToken}`);
            const id = listRes.body.entries[0].id;

            // Reveal
            const res = await request(app)
                .get(`/api/passwords/${id}`)
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(res.body.entry.password).toBe(strongPassword);
        });
    });

    // 2. OAuth Flow Simulation
    describe('2. OAuth Flow Simulation', () => {
        it('should redirect when hitting provider endpoint (stub check)', async () => {
            // We expect a redirect to the provider (Google)
            const res = await request(app).get('/api/auth/google');
            expect(res.status).toBe(302);
        });

        it('should refresh token using cookie (simulating OAuth success page)', async () => {
            // OAuth success redirects to frontend, which calls /api/auth/refresh
            // We simulate this call using the refresh token we captured earlier

            expect(refreshToken).toBeDefined();

            const res = await request(app)
                .post('/api/auth/refresh')
                .set('Cookie', [refreshToken]);

            expect(res.status).toBe(200);
            expect(res.body.accessToken).toBeDefined();
            expect(res.body.user).toBeDefined();

            // Update access token for subsequent tests
            accessToken = res.body.accessToken;
        });

        it('should get current user with new token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(res.body.user.email).toBe(testEmail);
        });
    });

    // 3. Export/Import Roundtrip
    describe('3. Export/Import Roundtrip', () => {
        it('should export vault', async () => {
            const res = await request(app)
                .get('/api/passwords/export')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.entries)).toBe(true);
            expect(res.body.entries.length).toBeGreaterThanOrEqual(1);
            expect(res.body.entries[0].password).toBeDefined(); // Export includes passwords
        });

        it('should import vault entries', async () => {
            // Create a backup of current entries
            const exportRes = await request(app)
                .get('/api/passwords/export')
                .set('Authorization', `Bearer ${accessToken}`);

            const importPayload = exportRes.body.entries.map((e: any) => ({
                ...e,
                title: e.title + ' (Imported)'
            }));

            const res = await request(app)
                .post('/api/passwords/import')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({ entries: importPayload });

            expect(res.status).toBe(200);
            expect(res.body.count).toBe(importPayload.length);

            // Verify count increased
            const listRes = await request(app)
                .get('/api/passwords')
                .set('Authorization', `Bearer ${accessToken}`);

            // Original 1 + Imported 1 = 2
            expect(listRes.body.entries.length).toBeGreaterThanOrEqual(2);
        });
    });

    // 4. Password Health
    describe('4. Password Health', () => {
        it('should detect weak passwords', async () => {
            // Create a weak password
            await request(app)
                .post('/api/passwords')
                .set('Authorization', `Bearer ${accessToken}`)
                .send({
                    title: 'Weak Sauce',
                    password: weakPassword,
                    strength: 0,
                    tags: ['risk']
                });

            const res = await request(app)
                .get('/api/passwords/health')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(res.body.health).toBeDefined();
            // We should have at least 1 weak password
            expect(res.body.health.weak).toBeGreaterThanOrEqual(1);
        });
    });
});
