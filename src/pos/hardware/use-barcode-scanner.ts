'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Barcode symbologies the camera path asks for, widest-used first. */
export const POS_BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'qr_code',
] as const;

/**
 * Default keystroke gap, in milliseconds, below which input is treated as a
 * scan rather than typing.
 *
 * Retail scanners emit a whole code in well under 20 ms per character; a fast
 * human touch-typist sustains roughly 100-150 ms. 40 ms sits in the empty
 * space between the two. It is configurable because cheap Bluetooth scanners
 * and some virtual-COM drivers are slower, and because a store that keys codes
 * by hand may want it tightened.
 */
export const DEFAULT_SCAN_GAP_MS = 40;

/** Shortest string accepted as a scan. Below this, stray keystrokes win. */
export const MIN_SCAN_LENGTH = 4;

/**
 * Quiet time after the last character before a burst that never terminated is
 * taken as a whole scan.
 *
 * Plenty of scanners leave the factory with their suffix switched off, and
 * until v13.6.0 those filled the buffer with nothing to ever empty it: the till
 * sat doing nothing at all, which at a counter is indistinguishable from a
 * scanner that was never plugged in. Safe because of the gap rule in the
 * handler — the buffer can only hold characters that arrived faster than a
 * person types, so there is nothing here for a cashier's keystrokes to fall
 * into. The cost is that a scanner with no suffix can split one slow code into
 * two, which is why `pos-scanner-test.tsx` still tells a shop to switch the
 * suffix on.
 */
const IDLE_FLUSH_MS = 150;

export interface BarcodeScannerOptions {
  /** Called with the decoded payload. Fires for HID, camera, and manual entry alike. */
  onScan: (code: string) => void;
  /** Maximum ms between keystrokes still counted as one scan. Default 40. */
  gapMs?: number;
  /**
   * Suspend the keyboard listener outright.
   *
   * Open dialogs do NOT need this — they are detected from the DOM, see the
   * handler below. This is for a caller that wants the wedge off for a reason
   * the DOM cannot show.
   */
  disabled?: boolean;
}

export interface BarcodeScannerApi {
  /** Attach to a `<video>` element to preview the camera. Null until started. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** True while the camera is decoding. */
  cameraActive: boolean;
  /** False when this browser has no `BarcodeDetector` (Safari, Firefox). */
  cameraSupported: boolean;
  /** Set when the camera could not start — permission, no device, or decode failure. */
  cameraError: string | null;
  /**
   * The characters read so far in the burst in progress; empty between scans.
   *
   * Rendered at the register so that a scanner which types but never terminates
   * is visibly doing *something*. Nothing is focused on the register at rest, so
   * those characters otherwise land nowhere on screen and a shop cannot tell a
   * misconfigured scanner from a dead one.
   */
  pending: string;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  /** Feed a code in from a text input. Same path as a scan. */
  submitManual: (code: string) => void;
}

// `BarcodeDetector` is not in TypeScript's DOM lib yet. Narrow structural type
// rather than `any`, so the call sites below still get checked.
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
}
interface BarcodeDetectorCtor {
  new (options?: { formats?: readonly string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

function getDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

/**
 * One hook, three ways in: a hardware scanner, the camera, or typing.
 *
 * **Keyboard wedge (the important one).** Virtually every retail barcode
 * scanner is a USB or Bluetooth HID device that "types" the code and presses
 * Enter. Nothing needs pairing, no driver, no permission prompt — which is
 * exactly why it is the default path and why it must work before anything
 * else does. The listener is on `document` and stays out of the way of normal
 * typing by timing: characters arriving faster than `gapMs` apart accumulate
 * into a buffer, and Enter (or Tab) — or, for a scanner sending no suffix at
 * all, `IDLE_FLUSH_MS` of quiet — flushes it. Slow, human-paced characters
 * reset the buffer and are left alone, so a cashier can still type into the
 * search box without every keystroke being swallowed.
 *
 * **Camera.** Uses the native `BarcodeDetector`, so no bundled decoder and no
 * dependency. It only exists in Chromium, so `cameraSupported` is false on
 * Safari and Firefox and the caller shows the manual field instead of a button
 * that silently does nothing.
 *
 * **Manual.** Always available. A scanner that will not read a scuffed label
 * is a daily occurrence; there must always be a way to key the number.
 */
export function useBarcodeScanner({
  onScan,
  gapMs = DEFAULT_SCAN_GAP_MS,
  disabled = false,
}: BarcodeScannerOptions): BarcodeScannerApi {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pending, setPending] = useState('');
  const cameraSupported = getDetectorCtor() !== null;

  // Keep the latest callback without re-registering the listener on every
  // render — the buffer lives in a ref and would be lost by a re-subscribe
  // mid-scan, splitting one barcode across two events.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  // --- Keyboard wedge ---
  useEffect(() => {
    if (disabled || typeof document === 'undefined') return;

    let buffer = '';
    let lastKeyAt = 0;
    let idle: ReturnType<typeof setTimeout> | null = null;

    const cancelIdle = () => {
      if (idle !== null) {
        clearTimeout(idle);
        idle = null;
      }
    };

    const reset = () => {
      cancelIdle();
      buffer = '';
      setPending('');
    };

    const flush = () => {
      cancelIdle();
      const code = buffer;
      buffer = '';
      setPending('');
      if (code.length >= MIN_SCAN_LENGTH) onScanRef.current(code);
    };

    const handler = (event: KeyboardEvent) => {
      // A scanner never holds a modifier — except that Windows reports AltGr as
      // Ctrl+Alt, so a scanner emitting a character that needs AltGr on the
      // active layout arrives with both set and must not be thrown away. That
      // is not a corner case on the layouts this till ships for. Skipping the
      // rest leaves Ctrl+C, Cmd+V and every real shortcut working normally.
      const altGr = event.ctrlKey && event.altKey;
      if ((event.ctrlKey || event.metaKey || event.altKey) && !altGr) return;

      // A dialog owns the keyboard while it is open.
      //
      // Read from the DOM rather than signalled by the caller, because the
      // register is not the only thing that opens one: the POS header's
      // quick-add product and person forms are siblings of `PosRegister`, so a
      // `disabled` flag driven by the register's own phase could never see
      // them. Typing a price into one of those was being accumulated into the
      // scan buffer, and Enter — which this handler calls `preventDefault()`
      // on — fired a phantom scan instead of saving the form.
      //
      // Every dialog in the library sets role="dialog" (see `ui/dialog.tsx`
      // and `PosTenderDialog`), so this covers consumer-added ones too.
      const target = event.target;
      if (target instanceof Element && target.closest('[role="dialog"]')) return;

      const now = Date.now();
      const gap = now - lastKeyAt;
      lastKeyAt = now;

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (buffer.length >= MIN_SCAN_LENGTH) {
          // Stop the Enter from also submitting whatever form has focus —
          // the scan is the action, and a double-submit at a till means a
          // double sale.
          event.preventDefault();
          flush();
          return;
        }
        reset();
        return;
      }

      // Printable single characters only: ignore Shift, arrows, F-keys.
      if (event.key.length !== 1) return;

      // A held-down key repeats fast enough to be indistinguishable from a
      // scanner, and the idle flush below would post the result as a barcode.
      // Nothing else in the burst tells the two apart.
      if (event.repeat) {
        reset();
        return;
      }

      // Too slow to be a scanner — this is a person typing. Start over so
      // their keystrokes never accumulate into a phantom scan.
      if (gap > gapMs) buffer = '';
      buffer += event.key;
      setPending(buffer);

      cancelIdle();
      idle = setTimeout(flush, IDLE_FLUSH_MS);
    };

    document.addEventListener('keydown', handler, true);
    return () => {
      cancelIdle();
      setPending('');
      document.removeEventListener('keydown', handler, true);
    };
  }, [disabled, gapMs]);

  // --- Camera ---
  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    const Ctor = getDetectorCtor();
    if (!Ctor) {
      setCameraError('unsupported');
      return;
    }
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        // iOS refuses to play an inline video without both of these.
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        await video.play().catch(() => undefined);
      }

      const detector = new Ctor({ formats: POS_BARCODE_FORMATS });
      let lastCode = '';
      let lastCodeAt = 0;

      const tick = async () => {
        const el = videoRef.current;
        if (!el || !streamRef.current) return;
        if (el.readyState >= 2) {
          try {
            const found = await detector.detect(el);
            const raw = found[0]?.rawValue?.trim();
            const now = Date.now();
            // A barcode sits in frame for many frames. Debounce per-value so
            // one physical item is not added to the sale thirty times a second.
            if (raw && (raw !== lastCode || now - lastCodeAt > 1500)) {
              lastCode = raw;
              lastCodeAt = now;
              onScanRef.current(raw);
            }
          } catch {
            // A single failed frame is normal (motion blur, bad angle).
            // Keep decoding rather than tearing the camera down.
          }
        }
        frameRef.current = requestAnimationFrame(() => void tick());
      };
      frameRef.current = requestAnimationFrame(() => void tick());
    } catch (error) {
      const name = (error as { name?: string })?.name;
      setCameraError(name === 'NotAllowedError' ? 'denied' : 'failed');
      stopCamera();
    }
  }, [stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const submitManual = useCallback((code: string) => {
    const trimmed = code.trim();
    if (trimmed) onScanRef.current(trimmed);
  }, []);

  return {
    videoRef,
    cameraActive,
    cameraSupported,
    cameraError,
    pending,
    startCamera,
    stopCamera,
    submitManual,
  };
}
