import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read VITE_* variables from the shared .env at the repo root.
  envDir: '..',
  server: {
    port: 5173,
    // Proxy API calls in development so the auth cookie is same-origin.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
