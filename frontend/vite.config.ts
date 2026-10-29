import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
// Inside docker compose the backend is reachable under its service name;
// running `npm run dev` on the host it is not, so default to localhost and
// let compose override it (VITE_PROXY_TARGET=http://backend:8000).
const target = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000';
const apiProxy = {
  '/api': { target, changeOrigin: true },
  // The MCP server for AI agents; xfwd so its download links name this address.
  '/mcp': { target, changeOrigin: true, xfwd: true },
};

export default defineConfig({
  plugins: [react()],
  // Plotly's partial bundle pulls in has-hover, which reads Node's `global`.
  // The production build rewrites it; the dev server does not, and the
  // Potential Analysis page crashed there ("global is not defined").
  define: { global: 'globalThis' },
  server: {
    host: true,
    port: 5173,
    // Hostnames other than localhost that may open the dev server, per machine:
    // ALLOWED_HOSTS=name1,name2 npm run dev
    allowedHosts: process.env.ALLOWED_HOSTS?.split(',').filter(Boolean) ?? [],
    proxy: apiProxy,
  },
  // `vite preview` serves the production bundle; giving it the same proxy makes
  // it possible to exercise the real build against a local backend.
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
});
