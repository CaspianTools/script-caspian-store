'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface AdminHelpPageProps {
  className?: string;
}

interface HelpSection {
  id: string;
  title: string;
  body: ReactNode;
}

/**
 * In-admin Help & documentation: an operator handbook for running the store —
 * catalog, orders, plugins, settings, roles — plus the in-person register and
 * Instagram channel integrations. A sticky table-of-contents sidebar (scroll-spy
 * + click-to-jump) and a search box make it navigable. Content is read-only prose
 * (hard-coded English, like the other admin pages) and brand-neutral so it reads
 * correctly across rebranded forks. Section text is read from the DOM for search,
 * so there's no duplicated index to maintain.
 */
const HELP_SECTIONS: HelpSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    body: (
      <>
        <p>
          The admin is where you run the store: manage the catalog and orders, moderate engagement, edit
          storefront content, install payment/shipping/email providers, and configure settings. Everything
          here is gated to <b>admin</b> accounts.
        </p>
        <p>
          <b>Navigating:</b> the left sidebar groups pages by area. Create records from the <b>Quick add</b>{' '}
          button (or the header search) — there are no per-page “Add” buttons; act on a row from its menu;
          filter with each list’s toolbar; and run bulk actions by selecting rows.
        </p>
      </>
    ),
  },
  {
    id: 'catalog',
    title: 'Products & catalog',
    body: (
      <ul>
        <li>
          <b>Products</b> — the catalog list (image, price, status, stock). Open a product to edit it; set
          its images, price, sale, sizes/variants, categories, tags, and description. New products start as{' '}
          <b>draft</b> — publish when ready.
        </li>
        <li>
          <b>Categories / Collections / Tags / Taxonomies</b> organize the catalog and drive storefront
          filtering. Categories can nest (parent → child); collections and taxonomy terms (colors,
          materials, …) are flat.
        </li>
        <li>
          <b>Stock</b> is a per-size count on each product, edited in the product editor. Online orders and
          in-person sales both decrement it automatically. Turn tracking, low-stock badges, and
          out-of-stock behaviour on or off under Settings → General → Inventory.
        </li>
        <li>
          <b>Import / Export</b> (Settings) moves catalog data in bulk as CSV — download a template, fill it
          in, and resolve each existing row on import (Skip / Overwrite / Create new).
        </li>
      </ul>
    ),
  },
  {
    id: 'orders',
    title: 'Orders & customers',
    body: (
      <ul>
        <li>
          <b>Orders</b> lists every order with its channel (online vs in-person POS), status, total, and
          customer. Open one to see line items, totals, and shipping; change its status as you fulfil it.
        </li>
        <li>
          <b>Users</b> are the registered customers (and staff/admins). Open a user to see their profile and
          recent orders. <b>Abandoned carts</b> surfaces shoppers who added items but didn’t check out.
        </li>
        <li>
          Refunds and payment captures happen in your payment provider’s own dashboard (e.g. Stripe); the
          admin reflects the resulting order status.
        </li>
      </ul>
    ),
  },
  {
    id: 'engagement',
    title: 'Reviews, questions & contacts',
    body: (
      <ul>
        <li>
          <b>Reviews</b> and <b>Questions</b> are customer-submitted and start <b>pending</b> — approve or
          reject them; only approved ones show on the storefront. Answer questions inline.
        </li>
        <li>
          <b>Subscribers</b> is the newsletter list (export it for your email tool). <b>Contacts</b> holds
          “Contact us” form submissions — read and action them here.
        </li>
      </ul>
    ),
  },
  {
    id: 'content',
    title: 'Content & pages',
    body: (
      <ul>
        <li>
          <b>Pages</b> — the page builder edits the homepage and custom/content pages (About, Privacy, Terms,
          …) as drag-and-drop blocks with per-block styling. Choose which page visitors land on at{' '}
          <code>/</code>.
        </li>
        <li>
          <b>Journal</b> is the blog/editorial; <b>FAQs</b> are the storefront help entries (the <b>Order</b>{' '}
          field controls their sort).
        </li>
        <li>
          <b>Appearance / Templates</b> (Settings) pick the overall look; brand name, logo, and social links
          live under Settings → General.
        </li>
      </ul>
    ),
  },
  {
    id: 'plugins',
    title: 'Plugins: shipping, payments & email',
    body: (
      <>
        <p>
          Shipping, payment, and email providers are <b>plugins</b>: browse the catalog, <b>Install</b> the
          one you need, <b>configure</b> it, then flip its <b>Enable</b> toggle. A provider can’t be enabled
          until its config validates.
        </p>
        <ul>
          <li>
            <b>Payments</b> — e.g. Stripe (cards) and regional gateways. The <b>publishable</b> key lives in
            the install record; the <b>secret</b> key + webhook secret are <b>Cloud Functions secrets</b>{' '}
            (never stored in the database). Add the gateway’s webhook endpoint where required.
          </li>
          <li>
            <b>Email</b> — SendGrid or Brevo for order + contact emails. The API key is a Cloud Functions
            secret; set it, deploy the email functions, then install + enable the provider. Edit templates
            under Settings → Emails.
          </li>
          <li>
            <b>Shipping</b> — rate methods shown at checkout; configure each and enable the ones shoppers
            should see.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'settings',
    title: 'Settings',
    body: (
      <ul>
        <li><b>General</b> — brand name, logo, favicon, social links, contact details.</li>
        <li><b>Localization / Languages</b> — currency, timezone, and which storefront locales are available.</li>
        <li><b>Tax / Returns / Reviews / Inventory</b> — store policies and behavior toggles.</li>
        <li><b>Emails</b> — sender identity + transactional templates. <b>Import / Export</b> — bulk CSV.</li>
      </ul>
    ),
  },
  {
    id: 'access',
    title: 'Admin access & roles',
    body: (
      <ul>
        <li>
          Accounts have a <b>role</b>: <b>admin</b> (full access), <b>staff</b> (POS / inventory, no admin
          settings), or <b>customer</b>.
        </li>
        <li>
          <b>First admin:</b> when the admin Cloud Functions are deployed, the very first user to register is
          auto-promoted to admin. Otherwise grant it from the command line (the <code>grant-admin</code>{' '}
          script) or via the setup wizard.
        </li>
        <li>
          <b>Cashiers</b> need the <b>staff</b> role (Users → set the role menu to Staff). Staff can ring up
          sales at <code>/pos</code> and read the catalog, but can’t change store settings.
        </li>
      </ul>
    ),
  },
  {
    id: 'pos',
    title: 'Point of sale (in-person register)',
    body: (
      <>
        <p>
          The <b>register</b> is built in. It runs in this same app at <code>/pos</code> — there is
          nothing extra to install. Turn it on under <b>Sales → Point of sale</b>.
        </p>
        <ol>
          <li>
            Give each cashier the <b>staff</b> role (Users → pick <b>Staff</b> from the role menu).
            Staff can ring up sales and read the catalog, but cannot reach the admin panel or change
            settings.
          </li>
          <li>
            Put a <b>barcode</b> on your products (Products → edit → Barcode). Almost any USB or
            Bluetooth scanner will fill that field in for you — click into it and scan.
          </li>
          <li>
            Open <code>/pos</code> and scan. A hardware scanner needs no setup at all; you can also use
            the camera (Chrome and Edge only), or type a barcode or SKU by hand.
          </li>
          <li>
            Take cash, card, or a split of both. Change is worked out for you, and the receipt prints
            through your normal printer dialog.
          </li>
        </ol>
        <p>
          Each register remembers its own name, language, and scanner settings at{' '}
          <code>/pos/settings</code> — so one shop can run an English till at the counter and another
          in a different language, without touching the website.
        </p>
        <p>
          Prices, discounts, and stock are worked out on the server rather than by the till, so a sale
          records what a product actually costs even if someone tampers with the browser.
        </p>
      </>
    ),
  },
  {
    id: 'instagram',
    title: 'Instagram channel',
    body: (
      <>
        <p>
          With the Instagram functions deployed, staff can view this store’s Instagram feed, moderate
          comments, publish a product as a post, and delete posts. The Meta app secret and access token
          stay server-side in your Cloud Functions — they never reach the browser. To go live:
        </p>
        <ol>
          <li>
            <b>Create one Meta app</b> at <b>developers.facebook.com</b> (Business type) → add the{' '}
            <b>Facebook Login</b> and <b>Instagram</b> products. Note the <b>App ID</b> (public) and{' '}
            <b>App Secret</b> (server-side only).
          </li>
          <li>
            Facebook Login → <b>Valid OAuth Redirect URIs</b> → add <b>http://127.0.0.1:47113/</b> (the POS
            loopback). Request <b>instagram_basic</b>, <b>instagram_manage_comments</b>,{' '}
            <b>instagram_content_publish</b>, <b>instagram_manage_contents</b>, <b>pages_show_list</b>,{' '}
            <b>pages_read_engagement</b>, <b>business_management</b>, then complete <b>Business Verification</b>{' '}
            + <b>App Review</b>.
          </li>
          <li>
            Make this store’s Instagram a <b>Professional</b> account linked to a <b>Facebook Page</b>.
          </li>
          <li>
            In the backend: set the <b>META_APP_ID</b> and <b>META_APP_SECRET</b> secrets, enable{' '}
            <b>Cloud Scheduler</b> (token refresh), deploy the rules, and deploy the Instagram functions
            (<code>npm run deploy:instagram</code>).
          </li>
          <li>
            Note there is <b>no Instagram screen in this admin panel</b>. This package ships the Cloud
            Functions only, so the OAuth exchange (<code>linkInstagram</code>) and the Meta app ID are driven
            from whatever front end you build on them. After an update that adds a capability, reconnect once
            to grant the new permission.
          </li>
        </ol>
        <p>
          Rate limits apply (~100 published posts / 24h). Product tagging on posts is not included — it needs
          a Meta Commerce catalog + an approved Instagram Shop with checkout.
        </p>
      </>
    ),
  },
  {
    id: 'updates',
    title: 'Updates & about',
    body: (
      <p>
        <b>Admin → About</b> shows the version this store is running and recent release notes. Apply updates
        per your deployment (the store’s update flow or a redeploy), and re-deploy Firestore rules when a
        release note calls for it.
      </p>
    ),
  },
];

const HELP_STYLES = `
.cs-help { max-width: 1040px; }
.cs-help__head h1 { font-size: 24px; font-weight: 700; margin: 0; }
.cs-help__head p { color: #667085; margin: 4px 0 0; font-size: 14px; }
.cs-help__layout {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  margin-top: 16px;
}
.cs-help__nav { position: sticky; top: 0; align-self: start; display: flex; flex-direction: column; gap: 10px; }
.cs-help__search { display: flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 9px; }
.cs-help__search svg { flex: none; color: #98a2b3; }
.cs-help__search input { width: 100%; border: none; outline: none; background: transparent; color: #111827; font: inherit; font-size: 13px; }
.cs-help__toc { display: flex; flex-direction: column; gap: 1px; max-height: calc(100vh - 150px); overflow-y: auto; }
.cs-help__toc button {
  appearance: none; background: none; border: 0; border-left: 2px solid transparent; text-align: left;
  color: #667085; font: inherit; font-size: 13px; padding: 6px 9px; border-radius: 6px; cursor: pointer;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.cs-help__toc button:hover { background: #f2f4f7; color: #111827; }
.cs-help__toc button.is-on { color: #2563eb; background: rgba(37,99,235,0.08); border-left-color: #2563eb; }
.cs-help__toc .cs-help__empty { color: #98a2b3; font-size: 13px; padding: 6px 9px; }
.cs-help__body { font-size: 14px; line-height: 1.6; color: #1f2937; }
.cs-help__section { scroll-margin-top: 12px; }
.cs-help__section.is-hidden { display: none; }
.cs-help__section h2 { font-size: 16px; font-weight: 700; margin: 22px 0 6px; }
.cs-help__section p { margin: 6px 0; }
.cs-help__section ul, .cs-help__section ol { margin: 6px 0; padding-left: 20px; }
.cs-help__section li { margin: 5px 0; }
.cs-help__section code { background: #f2f4f7; border-radius: 4px; padding: 0 4px; font-size: 12.5px; }
`;

function SearchGlyph(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function AdminHelpPage({ className }: AdminHelpPageProps): ReactNode {
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string>(HELP_SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const textRef = useRef<Record<string, string>>({});

  // Capture each section's plain text once (static content) for searching.
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const s of HELP_SECTIONS) {
      map[s.id] = `${s.title} ${sectionRefs.current[s.id]?.textContent ?? ''}`.toLowerCase();
    }
    textRef.current = map;
  }, []);

  const q = query.trim().toLowerCase();
  const matched = useMemo(() => {
    if (!q) return new Set(HELP_SECTIONS.map((s) => s.id));
    return new Set(
      HELP_SECTIONS.filter((s) => (textRef.current[s.id] ?? s.title.toLowerCase()).includes(q)).map(
        (s) => s.id,
      ),
    );
  }, [q]);

  // Scroll-spy: highlight the section nearest the top of the scroll area.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActiveId((top.target as HTMLElement).id);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    for (const s of HELP_SECTIONS) {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  const jumpTo = (id: string): void => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  const tocItems = q ? HELP_SECTIONS.filter((s) => matched.has(s.id)) : HELP_SECTIONS;

  return (
    <div className={className ? `cs-help ${className}` : 'cs-help'}>
      <style>{HELP_STYLES}</style>
      <div className="cs-help__head">
        <h1>Help &amp; documentation</h1>
        <p>Run the store, open the in-person register, and go live with the Instagram channel.</p>
      </div>

      <div className="cs-help__layout">
        <aside className="cs-help__nav">
          <div className="cs-help__search">
            <SearchGlyph />
            <input
              placeholder="Search docs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search documentation"
            />
          </div>
          <nav className="cs-help__toc">
            {tocItems.length === 0 ? (
              <span className="cs-help__empty">No matches</span>
            ) : (
              tocItems.map((s) => (
                <button
                  key={s.id}
                  className={!q && s.id === activeId ? 'is-on' : undefined}
                  onClick={() => jumpTo(s.id)}
                  title={s.title}
                >
                  {s.title}
                </button>
              ))
            )}
          </nav>
        </aside>

        <div className="cs-help__body">
          {q && matched.size === 0 && <p>No sections match “{query}”.</p>}
          {HELP_SECTIONS.map((s) => (
            <section
              key={s.id}
              id={s.id}
              ref={(el) => {
                sectionRefs.current[s.id] = el;
              }}
              className={matched.has(s.id) ? 'cs-help__section' : 'cs-help__section is-hidden'}
            >
              <h2>{s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
