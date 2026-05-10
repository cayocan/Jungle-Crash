import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/games': { target: 'http://localhost:8000', changeOrigin: true },
      '/wallets': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
});
