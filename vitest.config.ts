import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Playwright e2e lives in e2e/ and must not be picked up by Vitest.
    exclude: ['e2e/**', 'node_modules/**'],
    globals: true,
  },
});
