'use client';

import { useCaspianNavigation } from '../../../provider/caspian-store-provider';
import { useT } from '../../../i18n/locale-context';
import { cn } from '../../../utils/cn';
import { InboxIcon, ReceiptIcon, SlidersIcon, StoreIcon, UsersIcon } from '../../../ui/icons';
import { usePosLocalSession } from '../local-session-context';
import { usePosRoles } from '../role-context';
import { LocalPeoplePanel } from './local-people-panel';
import { LocalSalesPanel } from './local-sales-panel';
import { LocalShopPanel } from './local-shop-panel';
import { LocalBackupPanel } from './local-backup-panel';

export interface PosLocalAdminPageProps {
  className?: string;
}

type Section = 'sales' | 'people' | 'shop' | 'backup';

interface NavItem {
  value: Section;
  labelKey: string;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  { value: 'sales', labelKey: 'pos.admin.section.sales', icon: <ReceiptIcon size={16} /> },
  { value: 'people', labelKey: 'pos.admin.section.people', icon: <UsersIcon size={16} /> },
  { value: 'shop', labelKey: 'pos.admin.section.shop', icon: <StoreIcon size={16} /> },
  { value: 'backup', labelKey: 'pos.admin.section.backup', icon: <InboxIcon size={16} /> },
];

/**
 * The back office of a standalone till, at `/pos/admin`.
 *
 * The four sections are a segmented control rather than the collapsible sidebar
 * this used to carry. That sidebar was a near-copy of the settings page's, and
 * when parked it abbreviated each label to its first letter -- which made Sales
 * and Shop the same button. With the shell now owning navigation there is no
 * reason for a second column here at all.
 *
 * Items management lives on the dedicated Store page; this screen keeps sales,
 * people, shop settings and backups.
 */
export function PosLocalAdminPage({ className }: PosLocalAdminPageProps) {
  const t = useT();
  const { user } = usePosLocalSession();
  const { canAccess } = usePosRoles();
  const { searchParams, replace } = useCaspianNavigation();

  const sectionParam = searchParams?.get('section') as Section | null;
  const section: Section = NAV.some((n) => n.value === sectionParam) ? sectionParam! : 'sales';

  const setSection = (value: Section) => replace(`/pos/admin?section=${value}`);

  if (!canAccess(user?.role, 'admin')) {
    return (
      <div className="cpos-page">
        <div className="cpos-empty">
          <span className="cpos-empty__icon cpos-empty__icon--neutral">
            <SlidersIcon size={30} />
          </span>
          <p className="cpos-empty__title">{t('pos.admin.deniedTitle')}</p>
          <p className="cpos-empty__text">{t('pos.admin.deniedBody')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('cpos-page', className)}>
      <div className="cpos-pagehead">
        <span className="cpos-cardhead__icon cpos-cardhead__icon--brand">
          <SlidersIcon size={19} />
        </span>
        <span className="cpos-pagehead__text">
          <h1 className="cpos-pagehead__h">{t('pos.admin.title')}</h1>
          <p className="cpos-pagehead__sub">{t('pos.admin.subtitle')}</p>
        </span>
      </div>

      <div className="cpos-segmented" role="tablist" aria-label={t('pos.admin.title')}>
        {NAV.map((item) => {
          const active = section === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              className={cn('cpos-segmented__btn', active && 'cpos-segmented__btn--on')}
              onClick={() => setSection(item.value)}
            >
              <span className="cpos-segmented__icon">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="cpos-fadein" key={section}>
        {section === 'sales' && <LocalSalesPanel />}
        {section === 'people' && <LocalPeoplePanel />}
        {section === 'shop' && <LocalShopPanel />}
        {section === 'backup' && <LocalBackupPanel />}
      </div>
    </div>
  );
}
