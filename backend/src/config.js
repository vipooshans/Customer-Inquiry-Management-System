// Central place for configuration so nothing else reads process.env directly.
const isTest = process.env.NODE_ENV === 'test';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? (isTest ? 'test-secret' : undefined),
  isProduction: process.env.NODE_ENV === 'production',
};

if (!config.databaseUrl) throw new Error('DATABASE_URL (or TEST_DATABASE_URL in tests) is not set');
if (!config.jwtSecret) throw new Error('JWT_SECRET is not set');
