'use client';

import type { ReactNode } from 'react';
import { useCaspianNavigation } from '../provider/caspian-store-provider';

import { HomePage } from './home';
import { ProductDetailPage } from './product-detail-page';
import { ProductListPage } from './product-list-page';
import { CollectionsPage } from './collections-page';
import { CollectionDetailPage } from './collection-detail-page';
import { SearchResultsPage } from './search-results-page';
import { CartPage } from './cart-page';
import { CheckoutPage } from './checkout-page';
import { OrderConfirmationPage } from './order-confirmation-page';
import { GuestOrderLookupPage } from './guest-order-lookup-page';

import {
  AccountPage,
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
} from './auth';

import { JournalListPage, JournalDetailPage } from './journal';
import { FaqsPage } from './faqs';
import { ContactPage } from './contact';
import { ShippingReturnsPage } from './shipping';
import { SizeGuidePage } from './size-guide';
import { PageContentView } from './content';
import { SetupWizard, SetupInitPage } from './setup';
import { LayoutShell } from './layout-shell';
import { WishlistPage } from './wishlist/wishlist-page';
import type { SiteHeaderProps } from './site-header';
import type { SiteFooterProps } from './site-footer';

import { AdminGuard } from '../admin/admin-guard';
import { AdminShell } from '../admin/admin-shell';
import { AdminProfileMenu } from '../admin/admin-profile-menu';
import { AdminRoot } from '../admin/admin-root';
import { AdminAppearancePreviewPage } from '../admin/admin-appearance-preview-page';

export interface CaspianRootProps {
  /** Override the component rendered at `/`. Defaults to `<HomePage />`. */
  homepage?: ReactNode;
  /**
   * Render prop for paths the library doesn't own. Receives the pathname
   * and can render a consumer-owned page (blog, custom landing, etc.).
   * If omitted, unknown paths render a built-in 404 message.
   */
  fallback?: (args: { pathname: string }) => ReactNode;
  /**
   * Where the payment provider redirects after a successful checkout.
   * Default infers `${window.location.origin}/orders/success?session_id={CHECKOUT_SESSION_ID}`.
   */
  checkoutSuccessUrl?: string;
  /** Where the payment provider redirects on cancel. Default `${origin}/checkout`. */
  checkoutCancelUrl?: string;
  /** Where the setup wizard sends the admin after "Open my store". Default `/`. */
  setupFinishHref?: string;
  /** Override the admin shell's header slot. Default: `<AdminProfileMenu />`. */
  adminHeaderRight?: ReactNode;
  /** Pass-through to `<SiteHeader>` inside the storefront shell. Set `null` to hide. */
  header?: SiteHeaderProps | null;
  /** Pass-through to `<SiteFooter>` inside the storefront shell. Set `null` to hide. */
  footer?: SiteFooterProps | null;
}

/**
 * The one mount point. Owns every URL the library serves — storefront,
 * account, auth, content, admin — via pathname-based dispatch.
 *
 * Consumers mount this once at `app/[[...slug]]/page.tsx` and never touch
 * their route tree again: future library pages land as internal cases
 * here or in `<AdminRoot>`. Custom consumer pages can either (a) sit at
 * more specific Next.js route files (which win over the catch-all), or
 * (b) plug into the `fallback` render prop.
 */
export function CaspianRoot(props: CaspianRootProps = {}): ReactNode {
  const {
    homepage,
    fallback,
    checkoutSuccessUrl,
    checkoutCancelUrl,
    setupFinishHref,
    adminHeaderRight,
    header,
    footer,
  } = props;

  const nav = useCaspianNavigation();
  const path = stripLocalePrefix(nav.pathname) || '/';

  // Admin tree — AdminShell renders its own chrome. LayoutShell already
  // auto-bypasses its header/footer for `/admin/**`, so we don't wrap
  // this branch in LayoutShell.
  if (path === '/admin' || path.startsWith('/admin/')) {
    return (
      <AdminGuard>
        <AdminShell headerRight={adminHeaderRight ?? <AdminProfileMenu />}>
          <AdminRoot />
        </AdminShell>
      </AdminGuard>
    );
  }

  // Theme preview lives outside the admin shell on purpose (v4.0.0) so
  // the popup window isn't wrapped in AdminGuard + chrome. Also skips
  // LayoutShell for the same reason — it's a standalone preview window.
  if (path === '/admin-preview/appearance') {
    return <AdminAppearancePreviewPage />;
  }

  // Setup wizard — admin-gated, no storefront chrome. Matches the v1.24
  // scaffold that wrapped `/setup/**` in AdminGuard via its own layout.
  if (path === '/setup' || path === '/setup/init') {
    return (
      <AdminGuard>
        {path === '/setup/init' ? (
          <SetupInitPage />
        ) : (
          <SetupWizard finishHref={setupFinishHref} />
        )}
      </AdminGuard>
    );
  }

  return (
    <LayoutShell
      header={header}
      footer={footer}
      contentPaddingY={path === '/' ? 0 : 100}
    >
      {renderStorefrontPage()}
    </LayoutShell>
  );

  function renderStorefrontPage(): ReactNode {
  if (path === '/') {
    return <>{homepage ?? <HomePage />}</>;
  }

  if (path === '/cart') return <CartPage />;
  if (path === '/checkout') {
    return (
      <CheckoutPage
        successUrl={checkoutSuccessUrl ?? inferCheckoutSuccessUrl()}
        cancelUrl={checkoutCancelUrl ?? inferCheckoutCancelUrl()}
      />
    );
  }
  if (path === '/shop') return <ProductListPage title="Shop" />;
  if (path === '/collections') return <CollectionsPage />;
  {
    const m = path.match(/^\/collections\/([^/]+)$/);
    if (m) return <CollectionDetailPage slug={m[1]} />;
  }
  {
    const m = path.match(/^\/product\/([^/]+)$/);
    if (m) return <ProductDetailPage productSlugOrId={m[1]} />;
  }
  if (path === '/search') return <SearchResultsPage />;
  if (path === '/wishlist') return <WishlistPage />;

  if (path === '/orders/success') {
    const sessionId = nav.searchParams?.get('session_id');
    return sessionId ? <OrderConfirmationPage orderId={sessionId} /> : null;
  }

  if (path === '/order-status') return <GuestOrderLookupPage />;

  if (path === '/account') return <AccountPage />;
  if (path === '/login' || path === '/auth/login') return <LoginPage />;
  if (path === '/register' || path === '/auth/register') return <RegisterPage />;
  if (path === '/forgot-password' || path === '/auth/forgot-password') return <ForgotPasswordPage />;

  if (path === '/journal') return <JournalListPage />;
  {
    const m = path.match(/^\/journal\/([^/]+)$/);
    if (m) return <JournalDetailPage articleId={m[1]} />;
  }

  if (path === '/faqs') return <FaqsPage />;
  if (path === '/contact') return <ContactPage />;
  if (path === '/shipping-returns') return <ShippingReturnsPage />;
  if (path === '/size-guide') return <SizeGuidePage />;

  const contentKey = STATIC_CONTENT_PAGES.get(path);
  if (contentKey) {
    return (
      <PageContentView
        pageKey={contentKey}
        fallback={{
          title: toTitle(contentKey),
          content: 'This page has no content yet. Edit it in /admin/pages.',
        }}
      />
    );
  }

  if (fallback) return <>{fallback({ pathname: path })}</>;
  return <NotFound path={path} />;
  }
}

const STATIC_CONTENT_PAGES = new Map<string, string>([
  ['/about', 'about'],
  ['/privacy', 'privacy'],
  ['/terms', 'terms'],
  ['/sustainability', 'sustainability'],
]);

function toTitle(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function inferCheckoutSuccessUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/orders/success?session_id={CHECKOUT_SESSION_ID}`;
}

function inferCheckoutCancelUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/checkout`;
}

function stripLocalePrefix(pathname: string): string {
  const match = pathname.match(/^\/([a-z]{2})(\/|$)/i);
  if (!match) return pathname;
  return pathname.slice(match[1].length + 1) || '/';
}

function NotFound({ path }: { path: string }) {
  return (
    <div
      style={{
        maxWidth: 520,
        margin: '80px auto',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: 32, margin: 0 }}>Page not found</h1>
      <p style={{ color: '#666', marginTop: 8 }}>
        <code>{path}</code> doesn&apos;t match any route.
      </p>
    </div>
  );
}
