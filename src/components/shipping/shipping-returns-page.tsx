'use client';

import { useEffect, useState } from 'react';
import type { PageContent, ShippingPluginInstall } from '../../types';
import { listShippingPluginInstalls } from '../../services/shipping-plugin-service';
import { getShippingPlugin } from '../../shipping/catalog';
import { getPageContent } from '../../services/page-content-service';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { useFormatCurrency, useT } from '../../i18n/locale-context';
import { Skeleton } from '../../ui/misc';
import { Table, TBody, TD, TH, THead, TR } from '../../ui/table';
import { cn } from '../../utils/cn';

export interface ShippingReturnsPageProps {
  title?: string;
  subtitle?: string;
  /** PageContent doc id used for the returns copy. Default: `shipping-returns`. */
  returnsPageKey?: string;
  currency?: string;
  className?: string;
}

export function ShippingReturnsPage({
  title,
  subtitle,
  returnsPageKey = 'shipping-returns',
  currency = 'USD',
  className,
}: ShippingReturnsPageProps) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const priceFmt = useFormatCurrency(currency);
  const [installs, setInstalls] = useState<ShippingPluginInstall[] | null>(null);
  const [returnsContent, setReturnsContent] = useState<PageContent | null>(null);
  const [loadingReturns, setLoadingReturns] = useState(true);

  useEffect(() => {
    let alive = true;
    listShippingPluginInstalls(db, { onlyEnabled: true })
      .then((list) => {
        if (alive) setInstalls(list);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load shipping plugin installs:', error);
        if (alive) setInstalls([]);
      });
    getPageContent(db, returnsPageKey)
      .then((c) => {
        if (alive) setReturnsContent(c);
      })
      .catch((error) => {
        console.error('[caspian-store] Failed to load returns content:', error);
      })
      .finally(() => {
        if (alive) setLoadingReturns(false);
      });
    return () => {
      alive = false;
    };
  }, [db, returnsPageKey]);

  const describeContext = {
    currency,
    formatPrice: (n: number) => priceFmt.format(n),
  };

  return (
    <main
      className={cn('caspian-shipping-returns', 'caspian-page-gutter', className)}
      style={{ padding: '48px clamp(16px, 4vw, 24px)' }}
    >
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1
            style={{
              fontFamily: 'var(--caspian-font-headline, inherit)',
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              fontWeight: 700,
              margin: 0,
            }}
          >
            {title ?? t('shipping.title')}
          </h1>
          <p style={{ color: '#666', marginTop: 12, fontSize: 15 }}>
            {subtitle ?? t('shipping.subtitle')}
          </p>
        </header>

        <section style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontFamily: 'var(--caspian-font-headline, inherit)',
              fontSize: 20,
              fontWeight: 600,
              margin: 0,
              marginBottom: 12,
            }}
          >
            {t('shipping.methods.title')}
          </h2>

          {installs === null ? (
            <Skeleton style={{ height: 160 }} />
          ) : installs.length === 0 ? (
            <p style={{ color: '#888', fontSize: 14 }}>{t('shipping.methods.empty')}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t('shipping.methods.col.method')}</TH>
                  <TH>{t('shipping.methods.col.delivery')}</TH>
                  <TH style={{ textAlign: 'right' }}>{t('shipping.methods.col.cost')}</TH>
                </TR>
              </THead>
              <TBody>
                {installs.map((install) => {
                  const plugin = getShippingPlugin(install.pluginId);
                  let costLabel = '—';
                  if (plugin) {
                    try {
                      const validated = plugin.validateConfig(install.config);
                      costLabel = plugin.describe(validated, describeContext);
                    } catch {
                      costLabel = '—';
                    }
                  }
                  return (
                    <TR key={install.id}>
                      <TD style={{ fontWeight: 500 }}>{install.name}</TD>
                      <TD style={{ color: '#666' }}>
                        {install.estimatedDays?.min === install.estimatedDays?.max
                          ? `${install.estimatedDays?.min} ${t('shipping.methods.daysSuffix')}`
                          : `${install.estimatedDays?.min}–${install.estimatedDays?.max} ${t('shipping.methods.daysSuffix')}`}
                      </TD>
                      <TD style={{ textAlign: 'right', fontWeight: 600 }}>{costLabel}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </section>

        {loadingReturns ? null : returnsContent ? (
          <section>
            {returnsContent.title && (
              <h2
                style={{
                  fontFamily: 'var(--caspian-font-headline, inherit)',
                  fontSize: 20,
                  fontWeight: 600,
                  margin: 0,
                  marginBottom: 12,
                }}
              >
                {returnsContent.title}
              </h2>
            )}
            {returnsContent.subtitle && (
              <p style={{ color: '#666', marginBottom: 16 }}>{returnsContent.subtitle}</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 15, lineHeight: 1.7, color: '#333' }}>
              {(returnsContent.content ?? '')
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((p, i) => (
                  <p key={i} style={{ margin: 0 }}>
                    {p}
                  </p>
                ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
