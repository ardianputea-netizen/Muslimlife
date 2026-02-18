import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'HADIS_'],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/quran-api': {
        target: 'https://api.quran.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/quran-api/, ''),
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
