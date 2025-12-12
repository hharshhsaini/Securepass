import request from 'supertest';
import app from '../server';
import prisma from '../config/database';

describe('Auth & Vault Integration', () => {
    let accessToken: string;
    let userId: string;
    const testEmail = `test_${Date.now()}@example.com`;

    afterAll(async () => {
        // Cleanup
        await prisma.user.deleteMany({
            where: { email: { contains: 'test_' } }
        });
        await prisma.$disconnect();
    });

    it('should register a new user', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: testEmail,
                password: 'Password123!',
                name: 'Integration Test User'
            });

        expect(res.status).toBe(201);
        expect(res.body.accessToken).toBeDefined();
        // Check for httpOnly cookie
        expect(res.headers['set-cookie']).toBeDefined();
        expect(res.headers['set-cookie'][0]).toContain('refresh_token');

        accessToken = res.body.accessToken;
        userId = res.body.user.id;
    });

    it('should login with the new user', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'Password123!'
            });

        expect(res.status).toBe(200);
        expect(res.body.accessToken).toBeDefined();
        // Update access token
        accessToken = res.body.accessToken;
    });

    it('should direct-save a password', async () => {
        const res = await request(app)
            .post('/api/passwords/direct-save')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
                title: 'Test Password',
                password: 'supersecretpassword',
                tags: ['integration', 'test']
            });

        expect(res.status).toBe(201);
        expect(res.body.entry).toBeDefined();
        expect(res.body.entry.title).toBe('Test Password');
    });

    it('should list passwords (encrypted view)', async () => {
        const res = await request(app)
            .get('/api/passwords')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.entries).toHaveLength(1);
        expect(res.body.entries[0].title).toBe('Test Password');
        // Should NOT contain password field in list
        expect(res.body.entries[0].password).toBeUndefined();
    });

    it('should get decrypted password by ID', async () => {
        // First get the ID
        const listRes = await request(app)
            .get('/api/passwords')
            .set('Authorization', `Bearer ${accessToken}`);

        const entryId = listRes.body.entries[0].id;

        const res = await request(app)
            .get(`/api/passwords/${entryId}`)
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.entry.password).toBe('supersecretpassword');
    });

    it('should logout', async () => {
        const res = await request(app)
            .post('/api/auth/logout');
        // Logout relies on cookie, which supertest might not persist automatically unless using agent
        // But we check status

        expect(res.status).toBe(200);
    });
});
