import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  resolve: {
    alias: {
      '@core': resolve(import.meta.dirname, './src/core'),
      '@game': resolve(import.meta.dirname, './src/game'),
      '@ui': resolve(import.meta.dirname, './src/ui'),
      '@data': resolve(import.meta.dirname, './src/data'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        lms: resolve(import.meta.dirname, 'showcase/lms.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('phaser')) {
              return 'phaser';
            }
            if (id.includes('gsap') || id.includes('howler') || id.includes('pdfjs-dist')) {
              return 'vendor';
            }
          }
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
