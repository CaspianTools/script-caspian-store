import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { ServiceWorkerRegister, InstallAppPrompt } from '@caspian-explorer/script-caspian-store';
import { Providers } from './providers';

export const metadata = {
  title: 'Caspian Store Example',
  description: 'Minimal Next.js consumer of @caspian-explorer/script-caspian-store',
  manifest: '/manifest.webmanifest',
  icons: { apple: '/icon/180' },
  appleWebApp: { capable: true, statusBarStyle: 'default' as const, title: 'Caspian Store' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#111111',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
        <InstallAppPrompt />
      </body>
    </html>
  );
}
