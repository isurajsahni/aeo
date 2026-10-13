// Runs before every test file (before config is imported), so these values win over .env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-definitely-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_ROUNDS = '4';
process.env.COOKIE_SECURE = 'false';
