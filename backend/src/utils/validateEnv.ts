/**
 * Environment Validation
 * Validates all required security configuration at startup
 */

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validate all required environment variables for security
 */
export function validateEnvironment(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required variables
    const required = [
        'DATABASE_URL',
        'JWT_SECRET',
        'REFRESH_TOKEN_SECRET',
        'MASTER_KEY'
    ];

    for (const key of required) {
        if (!process.env[key]) {
            errors.push(`Missing required environment variable: ${key}`);
        }
    }

    // Validate MASTER_KEY is exactly 32 bytes (base64)
    if (process.env.MASTER_KEY) {
        try {
            const keyBuffer = Buffer.from(process.env.MASTER_KEY, 'base64');
            if (keyBuffer.length !== 32) {
                errors.push(`MASTER_KEY must be exactly 32 bytes (256 bits). Current: ${keyBuffer.length} bytes`);
            }
        } catch (e) {
            errors.push('MASTER_KEY is not valid base64');
        }
    }

    // Validate JWT_SECRET length
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        errors.push('JWT_SECRET should be at least 32 characters for security');
    }

    // Validate REFRESH_TOKEN_SECRET length
    if (process.env.REFRESH_TOKEN_SECRET && process.env.REFRESH_TOKEN_SECRET.length < 32) {
        errors.push('REFRESH_TOKEN_SECRET should be at least 32 characters for security');
    }

    // Validate bcrypt salt rounds
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
    if (saltRounds < 10) {
        warnings.push(`BCRYPT_SALT_ROUNDS is ${saltRounds}, minimum recommended is 12`);
    }

    // Validate JWT expiry times
    const accessExpiry = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    if (accessExpiry.includes('d') || accessExpiry.includes('h')) {
        warnings.push(`JWT_ACCESS_EXPIRES_IN (${accessExpiry}) should be short-lived (minutes). Consider using '15m'`);
    }

    // Check for production settings
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.FRONTEND_ORIGIN || process.env.FRONTEND_ORIGIN.includes('localhost')) {
            errors.push('FRONTEND_ORIGIN should not use localhost in production');
        }

        // Warn if using env MASTER_KEY in production
        warnings.push('PRODUCTION: Consider using KMS (AWS/GCP/Azure) for MASTER_KEY instead of environment variable');
    }

    // OAuth optional warnings
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        warnings.push('Google OAuth not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET)');
    }

    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        warnings.push('GitHub OAuth not configured (GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET)');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Log validation results and exit if invalid
 */
export function validateAndLog(): void {
    const result = validateEnvironment();

    // Log warnings
    if (result.warnings.length > 0) {
        console.warn('⚠️  Configuration Warnings:');
        result.warnings.forEach(w => console.warn(`   - ${w}`));
    }

    // Log errors and exit if invalid
    if (!result.valid) {
        console.error('❌ Configuration Errors:');
        result.errors.forEach(e => console.error(`   - ${e}`));
        console.error('\n🛑 Server startup aborted due to configuration errors.');
        console.error('   Please fix the above issues in your .env file.\n');

        if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
        }
    } else {
        console.log('✅ Security configuration validated');
    }
}
