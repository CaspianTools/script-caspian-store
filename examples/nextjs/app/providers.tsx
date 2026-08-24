'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  CaspianStoreProvider,
  type CaspianLinkProps,
  type CaspianImageProps,
} from '@caspian-explorer/script-caspian-store';
import '@caspian-explorer/script-caspian-store/styles.css';

// Adapter: expose next/link through the Caspian contract.
function CaspianNextLink({ href, children, ...rest }: CaspianLinkProps) {
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}

// Adapter: expose next/image through the Caspian contract.
function CaspianNextImage({ src, alt, width, height, fill, priority, className, sizes }: CaspianImageProps) {
  if (fill) {
    return <Image src={src} alt={alt} fill priority={priority} className={className} sizes={sizes} />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 600}
      height={height ?? 400}
      priority={priority}
      className={className}
      sizes={sizes}
    />
  );
}

function useCaspianNextNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return {
    pathname: pathname ?? '/',
    searchParams: new URLSearchParams(searchParams?.toString() ?? ''),
    push: (href: string) => router.push(href),
    replace: (href: string) => router.replace(href),
    back: () => router.back(),
  };
}

/**
 * Run the register with no Firebase project at all.
 *
 * Explicit, and deliberately never inferred from a missing config. A shop whose
 * credentials broke coming up as an empty local till would be a failure that
 * looks exactly like a working one — so an absent or invalid `firebaseConfig`
 * still throws at mount, as it always did.
 *
 *   NEXT_PUBLIC_CASPIAN_STANDALONE=1 npm run dev
 *
 * Everything then lives in this browser's IndexedDB: catalogue, staff, sales
 * and receipt numbers. Nothing is sent anywhere, and /pos is the only screen
 * with data behind it.
 */
const STANDALONE = process.env.NEXT_PUBLIC_CASPIAN_STANDALONE === '1';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const adapters = {
  Link: CaspianNextLink,
  Image: CaspianNextImage,
  useNavigation: useCaspianNextNavigation,
};

export function Providers({ children }: { children: ReactNode }) {
  if (STANDALONE) {
    return (
      <CaspianStoreProvider standalone adapters={adapters}>
        {children}
      </CaspianStoreProvider>
    );
  }

  return (
    <CaspianStoreProvider firebaseConfig={firebaseConfig} adapters={adapters}>
      {children}
    </CaspianStoreProvider>
  );
}
