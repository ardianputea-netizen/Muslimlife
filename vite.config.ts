import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildTime = process.env.VERCEL_GIT_COMMIT_TIMESTAMP || new Date().toISOString();
const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || 'local-dev';
const buildMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE || '';

export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_', 'HADIS_'],
  define: {
    __APP_BUILD_TIME__: JSON.stringify(buildTime),
    __APP_BUILD_SHA__: JSON.stringify(buildSha),
    __APP_BUILD_MESSAGE__: JSON.stringify(buildMessage),
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('maplibre-gl')) return 'vendor-maplibre';
          if (id.includes('recharts')) return 'vendor-recharts';
          if (id.includes('@supabase/supabase-js')) return 'vendor-supabase';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('motion')) return 'vendor-motion';

          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
        },
      },
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api/geocode': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: () => '/search',
        headers: {
          'Accept-Language': 'id,en',
          'User-Agent': 'MuslimLife/1.0 (contact: iqbal.adistia@gmail.com)',
        },
      },
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
