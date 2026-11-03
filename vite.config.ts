import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const api = `http://localhost:${process.env.PORT ?? 8787}`;

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // the static prototype swaps the network API for an in-browser one
  resolve: mode === 'demo' ? { alias: [{ find: /^(\.{1,2}\/)+api$/, replacement: fileURLToPath(new URL('./src/demoApi.ts', import.meta.url)) }] } : {},
  server: {
    port: 5173,
    proxy: { '/api': api, '/case-assets': api },
  },
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist', chunkSizeWarningLimit: 900, assetsInlineLimit: 100_000_000 },
}));
