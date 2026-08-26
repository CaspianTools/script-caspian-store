'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../../i18n/locale-context';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Table, TBody, TD, TH, THead, TR } from '../../../ui/table';
import { useToast } from '../../../ui/toast';
import { getPosDeviceId } from '../../pos-device';
import {
  createLocalTerminal,
  deleteLocalTerminal,
  listLocalTerminals,
  regenerateLocalTerminalCode,
  renameLocalTerminal,
} from '../local-terminals';
import { RecoveryCodeBlock } from '../pos-local-recovery';
import type { LocalTerminal } from '../types';
import { actions, field, fieldLabel, muted, row, section } from './panel-styles';
import { PanelLoadError } from './panel-load-error';

/**
 * The counters the shop has, and which machine answers to each.
 *
 * Two things this screen has to say plainly, because both are surprising and
 * neither is a bug:
 *
 * 1. **The roster does not sync.** A standalone till has no server and no wire
 *    to its siblings, so this list lives on this machine and reaches another
 *    only inside a backup. "Claimed" therefore means claimed as far as THIS
 *    till knows -- a counter taken on the machine in the stockroom shows as
 *    free here until a backup crosses over.
 * 2. **A pairing code is shown exactly once.** Only its scrambled form is kept,
 *    the way a password is, so nobody -- including whoever installed the till --
 *    can read it back off the machine afterwards. Losing the slip costs a new
 *    code, not the counter.
 */
export function LocalTerminalsPanel() {
  const t = useT();
  const { toast } = useToast();
  const [terminals, setTerminals] = useState<LocalTerminal[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  /** The code just minted, shown once. Cleared the moment anything else happens. */
  const [freshCode, setFreshCode] = useState<{ terminal: string; code: string } | null>(null);
  const [deviceId, setDeviceId] = useState('');

  const refresh = useCallback(async () => {
    // Guarded because this rejects when IndexedDB will not open, and an
    // unhandled rejection would leave the list null forever -- a permanent
    // "loading" that reads as the shop's counters having vanished.
    try {
      setTerminals(await listLocalTerminals());
      setLoadFailed(false);
    } catch {
      setTerminals([]);
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    // Read on mount rather than at module scope: `getPosDeviceId` touches
    // localStorage, which differs between server and client.
    setDeviceId(getPosDeviceId());
    void refresh();
  }, [refresh]);

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const { terminal, code } = await createLocalTerminal(trimmed);
      setName('');
      setFreshCode({ terminal: terminal.name, code });
      await refresh();
    } catch {
      toast({ title: t('pos.terminal.addFailed'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const rename = async (terminal: LocalTerminal, next: string) => {
    const trimmed = next.trim();
    if (!trimmed || trimmed === terminal.name) return;
    try {
      await renameLocalTerminal(terminal.id, trimmed);
      await refresh();
    } catch {
      toast({ title: t('pos.terminal.renameFailed'), variant: 'destructive' });
    }
  };

  const newCode = async (terminal: LocalTerminal) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(t('pos.terminal.confirmNewCode', { name: terminal.name }))
    ) {
      return;
    }
    try {
      const code = await regenerateLocalTerminalCode(terminal.id);
      if (code) setFreshCode({ terminal: terminal.name, code });
    } catch {
      toast({ title: t('pos.terminal.codeFailed'), variant: 'destructive' });
    }
  };

  const remove = async (terminal: LocalTerminal) => {
    const warning =
      terminal.claimedByDeviceId && terminal.claimedByDeviceId !== deviceId
        ? t('pos.terminal.confirmRemoveClaimed', { name: terminal.name })
        : t('pos.terminal.confirmRemove', { name: terminal.name });
    if (typeof window !== 'undefined' && !window.confirm(warning)) return;
    try {
      const result = await deleteLocalTerminal(terminal.id);
      if (!result.ok) {
        toast({ title: t('pos.terminal.removeShiftOpen'), variant: 'destructive' });
        return;
      }
      setFreshCode(null);
      await refresh();
      toast({ title: t('pos.terminal.removed') });
    } catch {
      toast({ title: t('pos.terminal.removeFailed'), variant: 'destructive' });
    }
  };

  return (
    <>
      <section style={section}>
        <strong>{t('pos.terminal.addTitle')}</strong>
        <p style={muted}>{t('pos.terminal.addHelp')}</p>
        <div style={row}>
          <div style={{ ...field, flex: '1 1 220px' }}>
            <span style={fieldLabel}>{t('pos.terminal.name')}</span>
            <Input
              value={name}
              placeholder={t('pos.terminal.namePlaceholder')}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button onClick={add} loading={saving} disabled={!name.trim()}>
            {t('pos.terminal.add')}
          </Button>
        </div>
      </section>

      {freshCode ? (
        <section style={section}>
          <strong>{t('pos.terminal.codeFor', { name: freshCode.terminal })}</strong>
          <p style={muted}>{t('pos.terminal.codeOnce')}</p>
          <RecoveryCodeBlock code={freshCode.code} />
          <div style={actions}>
            <Button variant="outline" onClick={() => setFreshCode(null)}>
              {t('pos.terminal.codeDone')}
            </Button>
          </div>
        </section>
      ) : null}

      <section style={section}>
        <strong>{t('pos.terminal.listTitle')}</strong>
        <p style={muted}>{t('pos.terminal.noSync')}</p>
        {loadFailed ? <PanelLoadError onRetry={refresh} /> : null}
        {terminals === null ? (
          <div className="cpos-skeleton" style={{ height: 120 }} />
        ) : terminals.length === 0 ? (
          <p style={muted}>{t('pos.terminal.empty')}</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('pos.terminal.colName')}</TH>
                <TH>{t('pos.terminal.colClaimed')}</TH>
                <TH style={{ textAlign: 'right' }}>{t('pos.terminal.colActions')}</TH>
              </TR>
            </THead>
            <TBody>
              {terminals.map((terminal) => (
                <TR key={terminal.id}>
                  <TD>
                    <Input
                      defaultValue={terminal.name}
                      // Commits on blur rather than on every keystroke: a write
                      // per character would be a write per character, and the
                      // roster is read on every register mount.
                      onBlur={(e) => void rename(terminal, e.target.value)}
                    />
                  </TD>
                  <TD style={{ fontSize: 13 }}>
                    {!terminal.claimedByDeviceId
                      ? t('pos.terminal.free')
                      : terminal.claimedByDeviceId === deviceId
                        ? t('pos.terminal.thisMachine')
                        : t('pos.terminal.otherMachine')}
                  </TD>
                  <TD style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <Button variant="outline" size="sm" onClick={() => void newCode(terminal)}>
                        {t('pos.terminal.newCode')}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => void remove(terminal)}>
                        {t('pos.terminal.remove')}
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>
    </>
  );
}
