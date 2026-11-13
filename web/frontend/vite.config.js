import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const BASE = '/artdou/';

export default defineConfig({
  base: BASE,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.ARTDOU_DEV_API_URL || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
});
