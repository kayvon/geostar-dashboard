import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: 'client/index.ts',
      formats: ['iife'],
      name: 'GeoStarClient',
      fileName: () => 'client.js',
    },
    outDir: 'public',
    emptyOutDir: false,
    minify: true,
    target: 'es2020',
  },
});
