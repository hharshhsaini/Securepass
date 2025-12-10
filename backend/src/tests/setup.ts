/**
 * Jest Test Setup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-must-be-long-enough';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-testing-must-be-long';
// 32 bytes base64 encoded key for AES-256
process.env.MASTER_KEY = 'CxkbUWFly4XNxTZcWNHzl+ErfLluC39+bJCTc1OFiO8=';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
process.env.BCRYPT_SALT_ROUNDS = '4'; // Lower for faster tests
