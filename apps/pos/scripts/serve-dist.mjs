#!/usr/bin/env node
/**
 * Serve the built register over HTTP for a real browser test.
 *
 * `vite preview` would do most of this, but not the one header that matters:
 * the service worker registers at scope `/pos` while the script itself is
 * served from the root, and a browser refuses that without
 * `Service-Worker-Allowed`. Without it the install button appears and then
 * silently does nothing.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist');
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

createServer((req, res) => {
  let pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (pathname.endsWith('/')) pathname += 'index.html';

  // A request may not climb out of dist/ via `..`.
  const file = normalize(join(root, pathname));
  if (!file.startsWith(root)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('forbidden');
    return;
  }

  readFile(file)
    .then((body) => {
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
        'Service-Worker-Allowed': '/pos',
        // The whole point of restarting this is to see the new build.
        'Cache-Control': 'no-store',
      });
      res.end(body);
    })
    .catch(() => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
    });
}).listen(port, '0.0.0.0', () => {
  console.log(`serving apps/pos/dist on http://localhost:${port}/pos/`);
});
