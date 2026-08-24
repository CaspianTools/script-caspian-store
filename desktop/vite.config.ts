import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The register is served from Tauri's custom protocol, not a web server, so
// every asset URL has to be relative -- an absolute "/assets/x.js" resolves
// against the protocol root and 404s. `base: './'` is what makes the bundle
// openable from inside the app.
export default defineConfig({
  base: './',
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // A till is a fixed machine we ship a binary to; there is no browser matrix
    // to support and no CDN to be kind to. One chunk loads fastest.
    target: 'chrome110',
    chunkSizeWarningLimit: 4000,
  },
  // Vite would otherwise pre-bundle the linked library on every dev start and
  // miss changes made in ../src.
  optimizeDeps: {
    exclude: ['@caspian-explorer/script-caspian-store'],
  },
  server: {
    port: 5183,
    strictPort: true,
  },
});
