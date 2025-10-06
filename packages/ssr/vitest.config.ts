import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/__tests__/**',
        '**/test/**',
        '**/tests/**',
      ],
      thresholds: {
        global: {
          branches: 40,
          functions: 60,
          lines: 40,
          statements: 40,
        },
      },
    },
  },
});
