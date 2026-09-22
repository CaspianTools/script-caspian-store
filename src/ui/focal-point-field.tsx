'use client';

import { useRef } from 'react';
import { Label } from './input';

export interface FocalPointFieldProps {
  label?: string;
  /** Focal point as a CSS position string, e.g. `"50% 50%"`. */
  value: string;
  onChange: (value: string) => void;
  /** Optional image shown behind the picker so the focus is set visually. */
  imageUrl?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

function parse(value: string): { x: number; y: number } {
  const m = (value || '').match(/([\d.]+)%\s+([\d.]+)%/);
  if (m) return { x: clamp(parseFloat(m[1])), y: clamp(parseFloat(m[2])) };
  return { x: 50, y: 50 };
}

/**
 * Focal-point picker: click or drag on the preview to set the focus, stored as
 * a CSS position (`"x% y%"`) and applied as `object-position` (images) or
 * `background-position` (backgrounds). Lets a cropped/`cover` image frame the
 * important part. Pointer-event based, no dependencies.
 */
export function FocalPointField({ label, value, onChange, imageUrl }: FocalPointFieldProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { x, y } = parse(value || '50% 50%');

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 1;
    let nx = x;
    let ny = y;
    switch (e.key) {
      case 'ArrowLeft':
        nx -= step;
        break;
      case 'ArrowRight':
        nx += step;
        break;
      case 'ArrowUp':
        ny -= step;
        break;
      case 'ArrowDown':
        ny += step;
        break;
      default:
        return;
    }
    e.preventDefault();
    onChange(`${Math.round(clamp(nx))}% ${Math.round(clamp(ny))}%`);
  };

  const setFromEvent = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const nx = clamp(((clientX - r.left) / r.width) * 100);
    const ny = clamp(((clientY - r.top) / r.height) * 100);
    onChange(`${Math.round(nx)}% ${Math.round(ny)}%`);
  };

  return (
    <div className="pb-field">
      {label && <Label>{label}</Label>}
      <div
        ref={ref}
        className="pb-focal"
        style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}
        role="slider"
        tabIndex={0}
        aria-label={label ?? 'Focal point'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={x}
        aria-valuetext={`${x}% ${y}%`}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) setFromEvent(e.clientX, e.clientY);
        }}
      >
        <span className="pb-focal__dot" style={{ left: `${x}%`, top: `${y}%` }} />
      </div>
    </div>
  );
}
