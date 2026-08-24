import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Absolute asset URLs. The Tauri build used `base: './'` because a custom
// protocol has no origin to resolve against; a real origin does, and the build
// script moves the built document down into `/pos/` afterwards. With an
// absolute base the asset URLs stay `/assets/...` wherever the document ends
// up, which matters because the service worker precaches exactly the list the
// page reports from its own `<script src>` and `<link href>` tags.
export default defineConfig({
  base: '/',
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // No `target` override. The Tauri build pinned `chrome110` because a till
    // was a fixed machine we shipped a binary to; this one is installed from
    // whatever browser the shop already has, so Vite's default browser matrix
    // is the right one -- including the iOS Safari that `PosInstallButton`
    // already has an "Add to Home Screen" branch for.
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
  preview: {
    port: 5183,
    strictPort: true,
  },
});
