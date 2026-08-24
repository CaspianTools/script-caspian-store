'use client';

import type { ReactNode } from 'react';

/**
 * The heading every standalone back-office screen wears.
 *
 * Sales and People were tab bodies inside one page until v12.2 and so had no
 * chrome of their own; promoting them to routes meant they arrived as a bare
 * panel under a top bar that only says which screen you are on. This is the
 * same markup `PosSettingsPage` and `LocalStorePanel` already use, lifted out
 * rather than pasted a third and fourth time.
 */
export function PosAdminPage({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="cpos-page">
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">{icon}</span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{title}</h1>
          {subtitle ? <p className="cpos-pagehead__sub">{subtitle}</p> : null}
        </span>
      </div>

      {children}
    </div>
  );
}
