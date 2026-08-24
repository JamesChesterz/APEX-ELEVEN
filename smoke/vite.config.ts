import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
  build: {
    ssr: 'smoke/render.tsx',
    outDir: 'smoke/dist',
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, 'render.tsx') },
  },
});
