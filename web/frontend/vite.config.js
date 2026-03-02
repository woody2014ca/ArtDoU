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
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
