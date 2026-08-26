'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../i18n/locale-context';
import { CheckIcon, ScanIcon } from '../../ui/icons';
import { usePosAdapter } from '../pos-adapter-context';
import { readScannerGapMs, writeScannerGapMs } from '../pos-preferences';
import { MIN_SCAN_LENGTH } from './use-barcode-scanner';

/** How long the panel waits for a first keystroke before calling the scanner silent. */
const LISTEN_TIMEOUT_MS = 20_000;

/** Quiet time that ends a burst when no Enter or Tab arrives. Longer than the
 * register's own flush, because here the whole point is to see the gap the
 * scanner really types at rather than to be quick about it. */
const BURST_END_MS = 500;

interface Reading {
  code: string;
  /** Milliseconds between consecutive printable characters. Empty for a one-character code. */
  gaps: number[];
  ending: 'enter' | 'tab' | 'none';
  /** Modifier names seen on a printable key, deduplicated. */
  modifiers: string[];
}

type Match =
  | { kind: 'looking' }
  | { kind: 'found'; name: string }
  | { kind: 'none' }
  | { kind: 'failed' };

const ENDING_KEY: Record<Reading['ending'], string> = {
  enter: 'pos.scannerTest.endingEnter',
  tab: 'pos.scannerTest.endingTab',
  none: 'pos.scannerTest.endingNone',
};

function suggestGap(worst: number): number {
  // Half again the worst gap this scanner produced, so a slower character on a
  // scuffed label still lands inside the window.
  return Math.min(300, Math.max(10, Math.ceil((worst * 3) / 2)));
}

/**
 * What the till is actually receiving from the scanner on this counter.
 *
 * Exists because every way the keyboard wedge can reject a real scan looks the
 * same from the counter: nothing happens. A scanner with no Enter suffix, one
 * typing slower than the gap setting, one sending modifier keys, and one that
 * is not in keyboard mode at all are four different problems with four
 * different fixes and one symptom. This separates them, and where the answer is
 * a number it offers to write that number.
 *
 * The listener is armed by a button rather than always on: this screen is not
 * the register, and a settings page that quietly swallowed Enter would be a
 * settings page whose Save button stopped working.
 */
export interface PosScannerTestProps {
  /**
   * Told the new gap when the panel writes one.
   *
   * Not optional politeness: both settings pages hold the scanner gap in their
   * own state and write it back on Save, so a page that did not hear about this
   * would put the old number straight back over it the next time somebody
   * pressed Save for an unrelated field.
   */
  onGapChange?: (ms: number) => void;
}

export function PosScannerTest({ onGapChange }: PosScannerTestProps) {
  const t = useT();
  const { adapter } = usePosAdapter();
  const [listening, setListening] = useState(false);
  const [silent, setSilent] = useState(false);
  const [reading, setReading] = useState<Reading | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [gapMs, setGapMs] = useState(0);
  const [savedGap, setSavedGap] = useState<number | null>(null);

  useEffect(() => {
    setGapMs(readScannerGapMs());
  }, []);

  useEffect(() => {
    if (!listening || typeof document === 'undefined') return;

    let code = '';
    const gaps: number[] = [];
    const modifiers = new Set<string>();
    let lastKeyAt = 0;
    let burst: ReturnType<typeof setTimeout> | null = null;

    const finish = (ending: Reading['ending']) => {
      if (burst !== null) clearTimeout(burst);
      burst = null;
      setReading({ code, gaps, ending, modifiers: [...modifiers] });
      setListening(false);
    };

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Tab') {
        // Swallowed so the button that armed this test is not re-pressed by the
        // scanner's own suffix, which would restart the test instead of ending it.
        event.preventDefault();
        if (code) finish(event.key === 'Enter' ? 'enter' : 'tab');
        return;
      }
      if (event.key.length !== 1 || event.repeat) return;

      event.preventDefault();
      const now = Date.now();
      if (code) gaps.push(now - lastKeyAt);
      lastKeyAt = now;
      code += event.key;

      // Windows reports AltGr as Ctrl+Alt. Named as AltGr, because that is what
      // the shop would have to change on the scanner.
      if (event.ctrlKey && event.altKey) modifiers.add('AltGr');
      else {
        if (event.ctrlKey) modifiers.add('Ctrl');
        if (event.altKey) modifiers.add('Alt');
      }
      if (event.metaKey) modifiers.add('Meta');

      if (burst !== null) clearTimeout(burst);
      burst = setTimeout(() => finish('none'), BURST_END_MS);
    };

    const giveUp = setTimeout(() => {
      if (!code) {
        setSilent(true);
        setListening(false);
      }
    }, LISTEN_TIMEOUT_MS);

    document.addEventListener('keydown', handler, true);
    return () => {
      if (burst !== null) clearTimeout(burst);
      clearTimeout(giveUp);
      document.removeEventListener('keydown', handler, true);
    };
  }, [listening]);

  useEffect(() => {
    if (!reading?.code) return;
    let alive = true;
    setMatch({ kind: 'looking' });
    adapter
      .lookupByCode(reading.code)
      .then((found) => {
        if (!alive) return;
        const first = found?.products[0];
        setMatch(first ? { kind: 'found', name: first.name } : { kind: 'none' });
      })
      .catch(() => {
        if (alive) setMatch({ kind: 'failed' });
      });
    return () => {
      alive = false;
    };
  }, [adapter, reading]);

  const start = useCallback(() => {
    setReading(null);
    setMatch(null);
    setSilent(false);
    setSavedGap(null);
    setGapMs(readScannerGapMs());
    setListening(true);
  }, []);

  const worstGap = reading?.gaps.length ? Math.max(...reading.gaps) : 0;
  const tooSlow = worstGap >= gapMs;
  const suggested = suggestGap(worstGap);
  const tooShort = Boolean(reading && reading.code.length < MIN_SCAN_LENGTH);

  const useSuggested = () => {
    writeScannerGapMs(suggested);
    const stored = readScannerGapMs();
    setSavedGap(stored);
    setGapMs(stored);
    onGapChange?.(stored);
  };

  return (
    <div className="cpos-field">
      <span className="cpos-field__label">{t('pos.scannerTest.title')}</span>
      <p className="cpos-muted">{t('pos.scannerTest.help')}</p>

      <div className="cpos-actions" style={{ justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="cpos-btn cpos-btn--outline"
          onClick={listening ? () => setListening(false) : start}
        >
          <ScanIcon size={16} />
          {listening
            ? t('pos.scannerTest.stop')
            : reading || silent
              ? t('pos.scannerTest.again')
              : t('pos.scannerTest.start')}
        </button>
      </div>

      {listening ? (
        <div className="cpos-note cpos-note--brand" role="status">
          {t('pos.scannerTest.listening')}
        </div>
      ) : null}

      {silent ? (
        <div className="cpos-note cpos-note--danger" role="status">
          <strong>{t('pos.scannerTest.silentTitle')}</strong>
          <br />
          {t('pos.scannerTest.silentHelp')}
        </div>
      ) : null}

      {reading ? (
        <>
          <div className="cpos-stats">
            <div className="cpos-stat">
              <span className="cpos-stat__label">{t('pos.scannerTest.code')}</span>
              {/* Smaller than a stat tile's figure, and allowed to wrap: a
                  13-digit EAN at 23px overflows the narrowest tile. */}
              <span className="cpos-stat__value" style={{ fontSize: 18, wordBreak: 'break-all' }}>
                {reading.code}
              </span>
              <span className="cpos-stat__hint">
                {t('pos.scannerTest.characters', { count: reading.code.length })}
              </span>
            </div>
            <div className="cpos-stat">
              <span className="cpos-stat__label">{t('pos.scannerTest.speed')}</span>
              <span className="cpos-stat__value">
                {reading.gaps.length ? t('pos.scannerTest.ms', { ms: worstGap }) : '—'}
              </span>
              <span className="cpos-stat__hint">{t('pos.scannerTest.speedHint', { gap: gapMs })}</span>
            </div>
            <div className="cpos-stat">
              <span className="cpos-stat__label">{t('pos.scannerTest.ending')}</span>
              <span className="cpos-stat__value">{t(ENDING_KEY[reading.ending])}</span>
              <span className="cpos-stat__hint">
                {reading.ending === 'none'
                  ? t('pos.scannerTest.endingNoneHint')
                  : t('pos.scannerTest.endingGoodHint')}
              </span>
            </div>
          </div>

          {tooSlow ? (
            <div className="cpos-note cpos-note--warning">
              {t('pos.scannerTest.tooSlow', { measured: worstGap, gap: gapMs })}
              <div className="cpos-actions" style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                <button type="button" className="cpos-btn cpos-btn--primary" onClick={useSuggested}>
                  {t('pos.scannerTest.useGap', { ms: suggested })}
                </button>
              </div>
            </div>
          ) : null}

          {savedGap !== null ? (
            <div className="cpos-note cpos-note--success" role="status">
              <CheckIcon size={15} /> {t('pos.scannerTest.gapSaved', { ms: savedGap })}
            </div>
          ) : null}

          {tooShort ? (
            <div className="cpos-note cpos-note--warning">
              {t('pos.scannerTest.tooShort', { min: MIN_SCAN_LENGTH })}
            </div>
          ) : null}

          {reading.ending === 'none' ? (
            <div className="cpos-note cpos-note--warning">
              {t('pos.scannerTest.endingNoneHelp')}
            </div>
          ) : null}

          {reading.modifiers.length ? (
            <div className="cpos-note cpos-note--warning">
              {t('pos.scannerTest.modifiers', { keys: reading.modifiers.join(', ') })}
            </div>
          ) : null}

          {match?.kind === 'found' ? (
            <div className="cpos-note cpos-note--success">
              {t('pos.scannerTest.matched', { name: match.name })}
            </div>
          ) : match?.kind === 'none' ? (
            <div className="cpos-note cpos-note--warning">{t('pos.scannerTest.noMatch')}</div>
          ) : match?.kind === 'failed' ? (
            <div className="cpos-note cpos-note--danger">{t('common.error')}</div>
          ) : null}

          {!tooSlow && !tooShort && reading.ending !== 'none' && !reading.modifiers.length ? (
            <div className="cpos-note cpos-note--success">{t('pos.scannerTest.allGood')}</div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
