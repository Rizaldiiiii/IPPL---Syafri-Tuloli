import { defineConfig } from 'vitest/config';

/**
 * Test integrasi memakai database SQLite terpisah (`server/prisma/test.db`) yang
 * dibuat ulang oleh `tests/globalSetup.ts`, sehingga tidak mengganggu `dev.db`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/tests/globalSetup.ts'],
    env: {
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'rahasia-uji-yang-panjang-dan-acak-0123456789',
      NODE_ENV: 'test',
    },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
