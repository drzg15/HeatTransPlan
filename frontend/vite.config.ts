import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
// Inside docker compose the backend is reachable under its service name;
// running `npm run dev` on the host it is not, so default to localhost and
// let compose override it (VITE_PROXY_TARGET=http://backend:8000).
const apiProxy = {
  '/api': {
    target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'hefter',
      'hefter.uni-paderborn.de',
      'heattransplan.uni-paderborn.de',
      '131.234.170.120',
    ],
    proxy: apiProxy,
  },
  // `vite preview` serves the production bundle; giving it the same proxy makes
  // it possible to exercise the real build against a local backend.
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
});
