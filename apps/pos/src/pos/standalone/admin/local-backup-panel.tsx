'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useT,
  useToast,
  cn,
  FieldDescription,
  useFormatDate,
} from '@caspian-explorer/script-caspian-store';
import {
  buildLocalBackup,
  localBackupFilename,
  parseLocalBackup,
  restoreLocalBackup,
  saveTextFile,
} from '../local-backup';
import { listLocalProducts, listLocalSales, listLocalUsers } from '../local-db';
import { pickBackupFolder, forgetBackupFolder, backupFolderSupported } from '../local-backup-folder';
import { usePosAutoBackupState } from '../auto-backup-context';

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
  const [countsError, setCountsError] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const auto = usePosAutoBackupState();
  const formatWhen = useFormatDate({ dateStyle: 'medium', timeStyle: 'short' });

  const refresh = useCallback(async () => {
    // Wrapped because an IndexedDB that will not open rejects here, and an
    // unhandled rejection left this screen showing nothing at all -- which is
    // exactly how "my sales disappeared" looks from the counter.
    try {
      const [products, users, sales] = await Promise.all([
        listLocalProducts(),
        listLocalUsers(),
        listLocalSales(),
      ]);
      setCounts({ products: products.length, users: users.length, sales: sales.length });
      setCountsError(false);
    } catch {
      setCounts(null);
      setCountsError(true);
    }
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
      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.admin.backup.title')}</h2>
        <div className="cpos-note cpos-note--warning">{t('pos.admin.backup.warning')}</div>
        {counts ? (
          <div className="cpos-muted">
            {t('pos.admin.backup.counts', {
              products: counts.products,
              users: counts.users,
              sales: counts.sales,
            })}
          </div>
        ) : null}
        {countsError ? (
          <div className="cpos-note cpos-note--warning">{t('pos.admin.backup.readFailed')}</div>
        ) : null}
        <FieldDescription>{t('pos.admin.backup.help')}</FieldDescription>
        {/*
          Said out loud rather than fixed by redaction. Stripping the accounts
          would produce a backup that restores a till nobody can sign into,
          which is a worse failure than the exposure; encrypting the file would
          create a second forgettable secret whose loss destroys the shop's only
          copy, which is the exact hole the recovery code exists to close. So
          the file keeps everything, and the screen says what is in it.
        */}
        <FieldDescription>{t('pos.admin.backup.credentialsNote')}</FieldDescription>
        <div className="cpos-actions">
          <button
            type="button"
            className="cpos-btn cpos-btn--primary"
            onClick={() => void backup()}
            disabled={busy}
          >
            {t('pos.admin.backup.download')}
          </button>
        </div>
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.admin.backup.auto.title')}</h2>
        {!backupFolderSupported() ? (
          <FieldDescription>{t('pos.admin.backup.auto.unsupported')}</FieldDescription>
        ) : (
          <>
            <FieldDescription>{t('pos.admin.backup.auto.help')}</FieldDescription>
            <FieldDescription>{t('pos.admin.backup.credentialsNote')}</FieldDescription>
            <div className="cpos-muted">
              {auto.folderName
                ? t('pos.admin.backup.auto.folder', { folder: auto.folderName })
                : t('pos.admin.backup.auto.noFolder')}
            </div>
            {auto.folderName ? (
              <div className="cpos-muted">
                {auto.lastOkMillis
                  ? t('pos.admin.backup.auto.last', {
                      when: formatWhen.format(new Date(auto.lastOkMillis)),
                    })
                  : t('pos.admin.backup.auto.never')}
              </div>
            ) : null}
            {auto.stale ? <div className="cpos-note cpos-note--warning">{t('pos.admin.backup.auto.stale')}</div> : null}
            {auto.permission === 'prompt' && auto.folderName ? (
              <div className="cpos-note cpos-note--warning">{t('pos.admin.backup.auto.needsPermission')}</div>
            ) : null}
            {auto.permission === 'denied' ? (
              <div className="cpos-note cpos-note--warning">{t('pos.admin.backup.auto.denied')}</div>
            ) : null}
            {auto.lastError && auto.lastError !== 'permission' ? (
              <div className="cpos-note cpos-note--warning">
                {t('pos.admin.backup.auto.failed', { reason: auto.lastError })}
              </div>
            ) : null}
            <div className="cpos-actions">
              <button
                type="button"
                className={cn(
                  'cpos-btn',
                  auto.folderName ? 'cpos-btn--outline' : 'cpos-btn--primary',
                )}
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    if (await pickBackupFolder()) {
                      await auto.refresh();
                      await auto.backupNow();
                      toast({ title: t('pos.admin.backup.auto.folderSet') });
                    }
                  })();
                }}
              >
                {auto.folderName
                  ? t('pos.admin.backup.auto.change')
                  : t('pos.admin.backup.auto.choose')}
              </button>
              {auto.folderName ? (
                <>
                  <button
                    type="button"
                    className="cpos-btn cpos-btn--outline"
                    disabled={busy || auto.running}
                    onClick={() => void auto.backupNow()}
                  >
                    {t('pos.admin.backup.auto.runNow')}
                  </button>
                  <button
                    type="button"
                    className="cpos-btn cpos-btn--ghost"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        await forgetBackupFolder();
                        await auto.refresh();
                      })();
                    }}
                  >
                    {t('pos.admin.backup.auto.stop')}
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}
      </section>

      <section className="cpos-section">
        <h2 className="cpos-section__title">{t('pos.admin.backup.restoreTitle')}</h2>
        <FieldDescription>{t('pos.admin.backup.restoreHelp')}</FieldDescription>
        <div className="cpos-actions">
          <button
            type="button"
            className="cpos-btn cpos-btn--outline"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            {t('pos.admin.backup.restore')}
          </button>
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
