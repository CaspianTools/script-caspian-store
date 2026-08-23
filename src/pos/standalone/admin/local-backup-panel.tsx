'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { useToast } from '../../../ui/toast';
import { FieldDescription } from '../../../ui/field-description';
import {
  buildLocalBackup,
  localBackupFilename,
  parseLocalBackup,
  restoreLocalBackup,
  saveTextFile,
} from '../local-backup';
import { listLocalProducts, listLocalSales, listLocalUsers } from '../local-db';
import { actions, fieldLabel, muted, section, warning } from './panel-styles';

/**
 * Backups, and the warning that goes with them.
 *
 * The warning is not decoration. A standalone till holds the only copy of a
 * shop's trading history, and the failure this screen exists to prevent — a
 * dead disk taking a year of sales with it — is silent right up until it is
 * total. So the counts are shown, not just a button: a shop that can see "1,284
 * sales on this computer" understands what it is about to lose.
 */
export function LocalBackupPanel() {
  const t = useT();
  const { toast } = useToast();
  const [counts, setCounts] = useState<{ products: number; users: number; sales: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [products, users, sales] = await Promise.all([
      listLocalProducts(),
      listLocalUsers(),
      listLocalSales(),
    ]);
    setCounts({ products: products.length, users: users.length, sales: sales.length });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const backup = async () => {
    setBusy(true);
    try {
      const data = await buildLocalBackup();
      saveTextFile(localBackupFilename(), JSON.stringify(data, null, 2));
      toast({ title: t('pos.admin.backup.done') });
    } finally {
      setBusy(false);
    }
  };

  const restore = async (file: File) => {
    const parsed = parseLocalBackup(await file.text());
    if (!parsed) {
      toast({ title: t('pos.admin.backup.notABackup') });
      return;
    }
    if (!window.confirm(t('pos.admin.backup.confirmRestore'))) return;
    setBusy(true);
    try {
      const result = await restoreLocalBackup(parsed);
      await refresh();
      toast({
        title: t('pos.admin.backup.restored', {
          products: result.products,
          users: result.users,
          sales: result.sales,
          skipped: result.salesSkipped,
        }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <section style={section}>
        <span style={fieldLabel}>{t('pos.admin.backup.title')}</span>
        <div style={warning}>{t('pos.admin.backup.warning')}</div>
        {counts ? (
          <div style={muted}>
            {t('pos.admin.backup.counts', {
              products: counts.products,
              users: counts.users,
              sales: counts.sales,
            })}
          </div>
        ) : null}
        <FieldDescription>{t('pos.admin.backup.help')}</FieldDescription>
        <div style={actions}>
          <Button onClick={() => void backup()} disabled={busy}>
            {t('pos.admin.backup.download')}
          </Button>
        </div>
      </section>

      <section style={section}>
        <span style={fieldLabel}>{t('pos.admin.backup.restoreTitle')}</span>
        <FieldDescription>{t('pos.admin.backup.restoreHelp')}</FieldDescription>
        <div style={actions}>
          <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
            {t('pos.admin.backup.restore')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void restore(file);
            }}
          />
        </div>
      </section>
    </div>
  );
}
