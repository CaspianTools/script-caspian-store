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
 * catalog, orders, plugins, settings, roles — plus the Instagram channel
 * integration. A sticky table-of-contents sidebar (scroll-spy
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
          <b>Navigating:</b> the left sidebar groups pages by area (Catalog, People, Sales, Content, then
          Plugins, Settings, Help and About). Each list page creates records from its own <b>+ New</b>{' '}
          button in the page header; rows carry inline <b>Edit</b> / <b>Delete</b> buttons (the Products
          list uses a row menu instead), and every list has a search box or filter row above the table.
          Deleting anything asks for confirmation first. The bell in the header shows pending moderation,
          new contact-form messages and library updates; the avatar menu opens your profile or signs you
          out.
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
          <b>Products</b> — the catalog list, switchable between a table and a card grid, filterable by
          status, category and brand. Open a product to edit its name, brand, price, images, sizes with
          per-size stock, category, collections, and any taxonomy terms you have enabled. The{' '}
          <b>Active</b> checkbox controls whether it shows on the storefront; unticked products are hidden.
        </li>
        <li>
          <b>Categories / Collections / Taxonomies</b> organize the catalog and drive storefront filtering.
          Categories can nest (parent → child); collections are flat. <b>Taxonomies</b> holds the terms for
          each taxonomy you have switched on under Settings → Taxonomies (brands, colors, materials, sizes,
          …).
        </li>
        <li>
          <b>Stock</b> is a per-size count on each product, edited in the product editor. Online orders and
          in-person sales both decrement it automatically. Tracking, low-stock badges and out-of-stock
          behaviour are set in the <b>Inventory</b> section of Settings → General.
        </li>
        <li>
          <b>Promo codes</b> are percentage or fixed-amount discounts with an optional minimum order and
          maximum discount; untick <b>Active</b> to pause one without deleting it.
        </li>
        <li>
          <b>Import / Export</b> (Settings) moves data in bulk as CSV — download a template, fill it in,
          and choose <b>Skip</b>, <b>Overwrite</b> or <b>Create new</b> for each row that already exists.
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
          <b>Orders</b> lists every order with its channel badge (<b>Online</b> or <b>POS</b>), status,
          total and customer. Open one to see line items, totals and the shipping address; change its
          status from the detail page as you fulfil it.
        </li>
        <li>
          <b>Users</b> are the registered accounts. Filter by role, change a role from the picker in the
          row (you confirm the change first), and open a user to see their profile, order count, lifetime
          spend, order history and current cart.
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
          reject them; only approved ones show on the storefront. Each row links to the product it belongs
          to. Use <b>Answer</b> on a question to reply; the answer appears under it on the product page.
        </li>
        <li>
          <b>Subscribers</b> is the newsletter list — search it, remove addresses, or export it as CSV from
          Settings → Import / Export. <b>Contacts</b> holds “Contact us” form submissions: open one to read
          it (which marks it read), then archive or delete it.
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
          <b>Pages</b> edits the long-form content pages (About, Contact, Privacy, Terms, Sustainability,
          Shipping & returns, Size guide) — each has a title, subtitle and body text where paragraphs are
          separated by blank lines.
        </li>
        <li>
          <b>Journal</b> is the blog/editorial: title, category, date, cover image, excerpt and body.{' '}
          <b>FAQs</b> are the storefront help entries; the <b>Display order</b> field controls their sort.
        </li>
        <li>
          <b>Appearance</b> picks a theme preset and <b>Templates</b> seeds a starter storefront (theme,
          products, categories, pages, journal). Brand name, logo and social links live under Settings →
          General.
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
          Shipping, payment, and email providers are <b>plugins</b>. Every plugin has a card under{' '}
          <b>Plugins</b> with an <b>Enable</b> switch; <b>Settings</b> opens that plugin’s own page. A
          plugin that needs details first (Stripe keys, bank details, an email provider) opens its
          settings page when you switch it on, and can’t be switched on until its settings are valid.
        </p>
        <ul>
          <li>
            <b>Payments</b> — e.g. Stripe (cards) and manual methods such as cash on delivery, bank transfer
            or cheque. The Stripe <b>publishable</b> key lives in the plugin’s settings; the <b>secret</b> key
            and webhook secret are <b>Cloud Functions secrets</b> (never stored in the database).
          </li>
          <li>
            <b>Email</b> — SendGrid or Brevo for order and contact emails. The provider API key is a{' '}
            <b>Cloud Functions secret</b>, not a setting in the admin; set it, deploy the email functions,
            then switch the provider on. Sender identity and templates are edited under Settings → Emails.
          </li>
          <li>
            <b>Shipping</b> — rate methods shown at checkout. One shipping plugin can hold several
            methods (say, Standard and Express flat rates), each with its own settings.
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
        <li>
          <b>General</b> — brand, coming-soon mode, localization (currency, timezone, currency display),
          contact details, social links, business hours, store address, accounts & privacy, reviews
          policy, cart behaviour, inventory, and tax & supported countries.
        </li>
        <li><b>Taxonomies</b> — switch product taxonomies (brands, colors, sizes, …) on or off.</li>
        <li><b>Shipping options</b> — site-wide toggles for how shipping is presented at checkout (the rate providers themselves live under Plugins).</li>
        <li><b>Emails</b> — sender identity + transactional templates.</li>
        <li><b>Languages</b> — which storefront locales are available and which is the default.</li>
        <li><b>Import / Export</b> — bulk CSV in and out.</li>
      </ul>
    ),
  },
  {
    id: 'access',
    title: 'Admin access & roles',
    body: (
      <ul>
        <li>
          Accounts have a <b>role</b>: <b>admin</b> (full access), <b>staff</b> (can use a register and
          read the catalog, no admin access), or <b>customer</b>. Change roles from the Users page.
        </li>
        <li>
          <b>First admin:</b> a signed-in account without the admin role sees an <b>Access denied</b> page
          with a <b>Claim admin role</b> button, which works only while the store has no admin yet.
          Otherwise grant the role from the command line (the <code>grant-admin</code> script) or by
          setting <code>role</code> to <code>"admin"</code> on the user’s document in Firestore.
        </li>
      </ul>
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
        <b>About</b> shows the version this store is running and recent release notes, with an{' '}
        <b>Update</b> button when a newer release exists. Apply updates per your deployment (the store’s
        update flow or a redeploy), and re-deploy Firestore rules when a release note calls for it.
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
.cs-help__body { font-size: 14px; line-height: 1.6; color: #1f2937; min-width: 0; overflow-wrap: anywhere; }
.cs-help__section pre { max-width: 100%; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
.cs-help__section table { display: block; max-width: 100%; overflow-x: auto; }
.cs-help__section { scroll-margin-top: 12px; }
.cs-help__section.is-hidden { display: none; }
.cs-help__section h2 { font-size: 16px; font-weight: 700; margin: 22px 0 6px; }
.cs-help__section p { margin: 6px 0; }
.cs-help__section ul, .cs-help__section ol { margin: 6px 0; padding-left: 20px; }
.cs-help__section li { margin: 5px 0; }
.cs-help__section code { background: #f2f4f7; border-radius: 4px; padding: 0 4px; font-size: 12.5px; }
/* Below 900px the shared .caspian-admin-subshell rules collapse the grid to one
   column and turn the aside into a horizontally scrolling row; only the TOC's
   own vertical-list styling needs undoing here. */
@media (max-width: 900px) {
  .cs-help__layout { gap: 16px; }
  .cs-help__toc { flex-direction: row; max-height: none; overflow: visible; }
  .cs-help__toc button { border-left: 0; }
}
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
        <p>Run the store and go live with the Instagram channel.</p>
      </div>

      <div className="cs-help__layout caspian-admin-subshell">
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
