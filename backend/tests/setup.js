// Loads .env so TEST_DATABASE_URL is available, then migrates and resets the test DB.
import { beforeAll, afterAll } from 'vitest';

process.loadEnvFile(new URL('../.env', import.meta.url));

// Imported after the env is loaded, because config.js reads it at import time.
const { migrate } = await import('../src/db/migrate.js');
const { seed } = await import('../src/db/seed.js');
const { pool } = await import('../src/db/pool.js');

beforeAll(async () => {
  await migrate();
  await pool.query('TRUNCATE inquiry_events, inquiries RESTART IDENTITY CASCADE');
  await seed();
});

afterAll(() => pool.end());
