import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false, // test files share one database
  },
});
