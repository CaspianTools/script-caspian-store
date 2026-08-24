import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CaspianRoot,
  CaspianStoreProvider,
  DEFAULT_SCRIPT_SETTINGS,
} from '@caspian-explorer/script-caspian-store';
import '@caspian-explorer/script-caspian-store/styles.css';
import { memoryAdapters } from './memory-navigation';

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
 * `posOnly` closes the other door: every storefront path renders a notice
 * pointing back at the register instead of a shop with no products in it.
 */
const container = document.getElementById('root');
if (!container) throw new Error('index.html is missing #root');

createRoot(container).render(
  <StrictMode>
    <CaspianStoreProvider
      standalone
      scriptSettings={{ features: { ...DEFAULT_SCRIPT_SETTINGS.features, posOnly: true } }}
      adapters={memoryAdapters}
    >
      <CaspianRoot />
    </CaspianStoreProvider>
  </StrictMode>,
);
