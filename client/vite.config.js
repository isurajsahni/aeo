import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read VITE_* variables from the shared .env at the repo root.
  envDir: '..',
  server: {
    // Override when the defaults are taken: CLIENT_PORT=5174 API_PORT=4100 npm run dev
    port: Number(process.env.CLIENT_PORT ?? 5173),
    // Proxy API calls in development so the auth cookie is same-origin.
    proxy: {
      '/api': { target: `http://localhost:${process.env.API_PORT ?? process.env.PORT ?? 4000}`, changeOrigin: true },
    },
  },
});
