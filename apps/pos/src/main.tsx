import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CaspianStoreProvider } from '@caspian-explorer/script-caspian-store';
import '@caspian-explorer/script-caspian-store/styles.css';
import { posAdapters } from './pos-navigation';
import { POS_MESSAGES } from './i18n';
import { PosApp } from './pos-app';
import { PosErrorBoundary } from './pos/standalone/ui/pos-error-boundary';
import { PosCrashScreen } from './pos/standalone/ui/pos-crash-screen';

/**
 * The whole register, running on nothing.
 *
 * `standalone` boots the provider tree with no Firebase project at all: the
 * catalogue, staff, sales and receipt numbers live in IndexedDB and the till
 * contacts no network. It is passed explicitly and never inferred -- the
 * library throws on a missing config rather than falling back, because a real
 * shop whose credentials broke coming up as an empty local register is a
 * failure that looks like a working till.
 *
 * `<PosApp>` rather than `<CaspianRoot>`: the library routes no `/pos` any
 * more, so there is no storefront to switch off with `posOnly` and no shop
 * behind this document to reach. The register is the only thing here.
 *
 * `POS_MESSAGES` carries every `pos.*` string, which used to ship inside the
 * library's own tables. It goes in through `messagesByLocale`, the seam the
 * provider already had for consumers extending a translation.
 *
 * Nothing here registers the service worker or asks to be installed. `PosShell`
 * already mounts `<PosServiceWorker>` and `<PosInstallButton>` itself, which is
 * why the deploy layout puts this document at `/pos/` -- the worker's scope is
 * `/pos` and the page has to be inside it.
 */
const container = document.getElementById('root');
if (!container) throw new Error('index.html is missing #root');

createRoot(container).render(
  <StrictMode>
    <CaspianStoreProvider standalone adapters={posAdapters} messagesByLocale={POS_MESSAGES}>
      {/*
        Inside the provider, not around it: the crash screen calls `useT`, so it
        needs the locale context that the provider supplies. It brings its own
        `PosStyleScope`, because the stylesheet is injected further down at
        `PosShell` and would be gone along with everything else it was wrapping.
      */}
      <PosErrorBoundary fallback={(state) => <PosCrashScreen {...state} />}>
        <PosApp />
      </PosErrorBoundary>
    </CaspianStoreProvider>
  </StrictMode>,
);
