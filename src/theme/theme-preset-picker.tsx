'use client';

import { useScriptSettings } from '../context/script-settings-context';
import { DEFAULT_SCRIPT_SETTINGS } from '../types';
import { useToast } from '../ui/toast';
import { cn } from '../utils/cn';
import { THEME_PRESETS, THEME_PRESET_LABELS, type ThemePresetName } from './presets';

export interface ThemePresetPickerProps {
  className?: string;
  onApplied?: (name: ThemePresetName) => void;
}

/**
 * Grid of small swatches representing each theme preset. Clicking a swatch
 * writes the preset to script settings and updates the live theme tokens.
 */
export function ThemePresetPicker({ className, onApplied }: ThemePresetPickerProps) {
  const { save, saving } = useScriptSettings();
  const { toast } = useToast();

  const apply = async (name: ThemePresetName) => {
    try {
      // `save` merges nested maps; write the optional tokens explicitly so a
      // previous preset's background/font cannot survive the switch.
      const tokens = THEME_PRESETS[name];
      await save({
        theme: {
          ...tokens,
          background: tokens.background ?? DEFAULT_SCRIPT_SETTINGS.theme.background!,
          fontFamily: tokens.fontFamily ?? DEFAULT_SCRIPT_SETTINGS.theme.fontFamily!,
        },
      });
      toast({ title: `Applied "${THEME_PRESET_LABELS[name]}"` });
      onApplied?.(name);
    } catch (error) {
      console.error('[caspian-store] Failed to apply preset:', error);
      toast({ title: 'Failed to apply preset', variant: 'destructive' });
    }
  };

  return (
    <div
      className={cn('caspian-theme-picker', className)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 10,
      }}
    >
      {(Object.keys(THEME_PRESETS) as ThemePresetName[]).map((name) => {
        const preset = THEME_PRESETS[name];
        return (
          <button
            key={name}
            type="button"
            disabled={saving}
            onClick={() => apply(name)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 10,
              border: '1px solid rgba(0,0,0,0.1)',
              background: '#fff',
              borderRadius: preset.radius,
              cursor: saving ? 'wait' : 'pointer',
              textAlign: 'left',
              transition: 'transform 0.05s',
            }}
          >
            <div style={{ display: 'flex', gap: 4 }}>
              <span style={swatchStyle(preset.primary)} />
              <span style={swatchStyle(preset.primaryForeground)} />
              <span style={swatchStyle(preset.accent)} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500 }}>{THEME_PRESET_LABELS[name]}</span>
          </button>
        );
      })}
    </div>
  );
}

function swatchStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-block',
    width: 20,
    height: 20,
    borderRadius: 4,
    background: color,
    border: '1px solid rgba(0,0,0,0.08)',
  };
}
