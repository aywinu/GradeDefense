import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@core': resolve(import.meta.dirname, './src/core'),
      '@game': resolve(import.meta.dirname, './src/game'),
      '@ui': resolve(import.meta.dirname, './src/ui'),
      '@data': resolve(import.meta.dirname, './src/data'),
    },
  },
});
