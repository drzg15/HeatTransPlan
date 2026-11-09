import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server only: serve the built documentation at /docs, as Caddy does in
// production; otherwise the app's own page answers /docs. Build it with
// `sphinx-build -b html docs docs/_build/html` (pip install -r docs/requirements.txt).
const docsDir = fileURLToPath(new URL('../docs/_build/html', import.meta.url));
const docTypes: Record<string, string> = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain',
};
const serveDocs: Plugin = {
  name: 'serve-docs',
  configureServer(server) {
    server.middlewares.use('/docs', (req, res) => {
      const rel = decodeURIComponent((req.url ?? '/').split('?')[0]);
      if (req.originalUrl?.split('?')[0] === '/docs') {
        res.writeHead(301, { Location: '/docs/' }).end();
        return;
      }
      let file = path.join(docsDir, rel);
      if (file !== docsDir && !file.startsWith(docsDir + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end(
          fs.existsSync(docsDir) ? 'Not found' : 'Docs not built: sphinx-build -b html docs docs/_build/html',
        );
        return;
      }
      res.writeHead(200, { 'Content-Type': docTypes[path.extname(file)] ?? 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
  },
};

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
  plugins: [react(), serveDocs],
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
