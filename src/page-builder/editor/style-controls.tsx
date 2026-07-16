'use client';

import { useT } from '../../i18n';
import { ColorField, FocalPointField, ImageUploadField, Input, Label, Select, Switch } from '../../ui';
import type { BlockStyle, BoxSpacing, PageBlock } from '../../types';
import { mergeStyles } from '../block-style';
import { useHomeEditor } from './home-editor-context';

/**
 * The Style tab — per-block visual overrides applied by the renderer as inline
 * CSS. Universal (same controls for every styleable block), so it's not driven
 * by the catalog field schema. On desktop it edits the block's base `style`; on
 * tablet/mobile it edits that breakpoint's `responsive` override (left blank =
 * inherit from desktop), plus a hide-on-this-device toggle.
 */
export function StyleControls({ block, storagePath }: { block: PageBlock; storagePath: string }) {
  const t = useT();
  const { breakpoint, setStyle, setDeviceHidden } = useHomeEditor();
  const style: BlockStyle =
    (breakpoint === 'desktop' ? block.style : block.responsive?.[breakpoint]?.style) ?? {};

  const update = (next: BlockStyle) => setStyle(block.id, next);
  const setBg = (patch: Partial<NonNullable<BlockStyle['background']>>) =>
    update({ ...style, background: { ...style.background, ...patch } });
  // The background controls READ from the effective (base ⊕ override) style so
  // they stay reachable on tablet/mobile even when only desktop set the image;
  // edits still WRITE to the override via `setBg`.
  const effective = breakpoint === 'desktop' ? style : mergeStyles(block.style, block.responsive?.[breakpoint]?.style);
  const bg = effective.background;
  const bgImage = bg?.imageUrl ?? '';

  return (
    <div className="pb-panel__section">
      {breakpoint !== 'desktop' && (
        <>
          <p className="pb-panel__note">{t('pageBuilder.style.deviceNote')}</p>
          <div className="pb-field">
            <Switch
              checked={Boolean(block.responsive?.[breakpoint]?.hidden)}
              onChange={(v) => setDeviceHidden(block.id, v)}
              label={t('pageBuilder.style.hideOnDevice')}
            />
          </div>
        </>
      )}
      <ColorField
        label={t('pageBuilder.style.bgColor')}
        value={bg?.color ?? ''}
        onChange={(v) => setBg({ color: v || undefined })}
      />

      <div className="pb-field">
        <ImageUploadField
          label={t('pageBuilder.style.bgImage')}
          value={bgImage}
          storagePath={storagePath}
          onChange={(url) => setBg({ imageUrl: url || undefined })}
          allowUrlFallback
          allowStockSearch
          onAttributionChange={(attr) => setBg({ imageAttribution: attr ?? undefined })}
          aspectRatio="16 / 9"
          previewMaxWidth={280}
        />
      </div>

      {bgImage && (
        <>
          <div className="pb-field">
            <Label>{t('pageBuilder.style.bgSize')}</Label>
            <Select
              value={bg?.size ?? 'cover'}
              options={[
                { value: 'cover', label: t('pageBuilder.bgSize.cover') },
                { value: 'contain', label: t('pageBuilder.bgSize.contain') },
                { value: 'auto', label: t('pageBuilder.bgSize.auto') },
              ]}
              onChange={(e) => setBg({ size: e.target.value })}
              style={{ width: '100%' }}
            />
          </div>
          <div className="pb-field">
            <Switch
              checked={Boolean(bg?.repeat)}
              onChange={(v) => setBg({ repeat: v || undefined })}
              label={t('pageBuilder.style.bgRepeat')}
            />
          </div>
          <ColorField
            label={t('pageBuilder.style.bgOverlay')}
            value={bg?.overlay ?? ''}
            onChange={(v) => setBg({ overlay: v || undefined })}
          />
          <FocalPointField
            label={t('pageBuilder.style.focalPoint')}
            value={bg?.position ?? '50% 50%'}
            imageUrl={bgImage}
            onChange={(pos) => setBg({ position: pos })}
          />
        </>
      )}

      <ColorField
        label={t('pageBuilder.style.textColor')}
        value={style.textColor ?? ''}
        onChange={(v) => update({ ...style, textColor: v || undefined })}
      />

      <div className="pb-field">
        <Label>{t('pageBuilder.field.align')}</Label>
        <Select
          value={style.align ?? ''}
          options={[
            { value: '', label: t('pageBuilder.align.inherit') },
            { value: 'left', label: t('pageBuilder.align.left') },
            { value: 'center', label: t('pageBuilder.align.center') },
            { value: 'right', label: t('pageBuilder.align.right') },
          ]}
          onChange={(e) => update({ ...style, align: (e.target.value || undefined) as BlockStyle['align'] })}
          style={{ width: '100%' }}
        />
      </div>

      <SpacingControl
        label={t('pageBuilder.style.padding')}
        value={style.padding}
        onChange={(p) => update({ ...style, padding: p })}
      />
      <SpacingControl
        label={t('pageBuilder.style.margin')}
        value={style.margin}
        onChange={(m) => update({ ...style, margin: m })}
      />

      <div className="pb-field">
        <Label>{t('pageBuilder.style.maxWidth')}</Label>
        <Input
          value={style.width ?? ''}
          placeholder="e.g. 720px"
          onChange={(e) => update({ ...style, width: e.target.value || undefined })}
        />
      </div>

      <div className="pb-field">
        <Label>{t('pageBuilder.style.gradient')}</Label>
        <Input
          value={bg?.gradient ?? ''}
          placeholder="linear-gradient(135deg, #f6d365, #fda085)"
          onChange={(e) => setBg({ gradient: e.target.value || undefined })}
        />
      </div>

      <TypographyControl value={style.typography} onChange={(typography) => update({ ...style, typography })} />

      <BorderControl
        border={style.border}
        radius={style.radius}
        onBorder={(border) => update({ ...style, border })}
        onRadius={(radius) => update({ ...style, radius })}
      />

      <ShadowControl value={style.shadow} onChange={(shadow) => update({ ...style, shadow })} />
    </div>
  );
}

const SHADOW_KEYS = ['sm', 'md', 'lg', 'xl'];
const isPresetShadow = (v: string | undefined): boolean => !!v && SHADOW_KEYS.includes(v);

function ShadowControl({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  const t = useT();
  const selectValue = value ? (isPresetShadow(value) ? value : 'custom') : '';
  return (
    <div className="pb-field">
      <Label>{t('pageBuilder.style.shadow')}</Label>
      <Select
        value={selectValue}
        options={[
          { value: '', label: t('pageBuilder.style.shadow.none') },
          { value: 'sm', label: t('pageBuilder.style.shadow.sm') },
          { value: 'md', label: t('pageBuilder.style.shadow.md') },
          { value: 'lg', label: t('pageBuilder.style.shadow.lg') },
          { value: 'xl', label: t('pageBuilder.style.shadow.xl') },
          { value: 'custom', label: t('pageBuilder.style.shadow.custom') },
        ]}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') onChange(undefined);
          else if (v === 'custom') onChange(isPresetShadow(value) || !value ? '0 4px 12px rgba(0,0,0,0.15)' : value);
          else onChange(v);
        }}
        style={{ width: '100%' }}
      />
      {value && !isPresetShadow(value) && (
        <Input
          value={value}
          placeholder="0 4px 12px rgba(0,0,0,0.15)"
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      )}
    </div>
  );
}

const FONT_WEIGHTS: { value: string; labelKey: string }[] = [
  { value: '', labelKey: 'pageBuilder.style.typo.weightInherit' },
  { value: '300', labelKey: 'pageBuilder.style.typo.light' },
  { value: '400', labelKey: 'pageBuilder.style.typo.regular' },
  { value: '500', labelKey: 'pageBuilder.style.typo.medium' },
  { value: '600', labelKey: 'pageBuilder.style.typo.semibold' },
  { value: '700', labelKey: 'pageBuilder.style.typo.bold' },
];

function TypographyControl({
  value,
  onChange,
}: {
  value: BlockStyle['typography'];
  onChange: (v: BlockStyle['typography']) => void;
}) {
  const t = useT();
  const v = value ?? {};
  const set = (patch: Partial<NonNullable<BlockStyle['typography']>>) => {
    const next = { ...v, ...patch };
    const empty =
      !next.fontSize && !next.fontWeight && !next.lineHeight && !next.letterSpacing && !next.textTransform;
    onChange(empty ? undefined : next);
  };
  return (
    <div className="pb-field">
      <Label>{t('pageBuilder.style.typography')}</Label>
      <div className="pb-grid2">
        <Input
          placeholder={t('pageBuilder.style.typo.fontSize')}
          value={v.fontSize ?? ''}
          onChange={(e) => set({ fontSize: e.target.value || undefined })}
        />
        <Select
          value={v.fontWeight ? String(v.fontWeight) : ''}
          options={FONT_WEIGHTS.map((w) => ({ value: w.value, label: t(w.labelKey) }))}
          onChange={(e) => set({ fontWeight: e.target.value ? Number(e.target.value) : undefined })}
        />
        <Input
          placeholder={t('pageBuilder.style.typo.lineHeight')}
          value={v.lineHeight ?? ''}
          onChange={(e) => set({ lineHeight: e.target.value || undefined })}
        />
        <Input
          placeholder={t('pageBuilder.style.typo.letterSpacing')}
          value={v.letterSpacing ?? ''}
          onChange={(e) => set({ letterSpacing: e.target.value || undefined })}
        />
      </div>
      <Select
        value={v.textTransform ?? ''}
        options={[
          { value: '', label: t('pageBuilder.style.typo.transformNone') },
          { value: 'uppercase', label: t('pageBuilder.style.typo.uppercase') },
          { value: 'lowercase', label: t('pageBuilder.style.typo.lowercase') },
          { value: 'capitalize', label: t('pageBuilder.style.typo.capitalize') },
        ]}
        onChange={(e) =>
          set({ textTransform: (e.target.value || undefined) as NonNullable<BlockStyle['typography']>['textTransform'] })
        }
        style={{ width: '100%', marginTop: 6 }}
      />
    </div>
  );
}

const RADIUS_CORNERS: { key: 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft'; labelKey: string }[] = [
  { key: 'topLeft', labelKey: 'pageBuilder.radius.topLeft' },
  { key: 'topRight', labelKey: 'pageBuilder.radius.topRight' },
  { key: 'bottomRight', labelKey: 'pageBuilder.radius.bottomRight' },
  { key: 'bottomLeft', labelKey: 'pageBuilder.radius.bottomLeft' },
];

function BorderControl({
  border,
  radius,
  onBorder,
  onRadius,
}: {
  border: BlockStyle['border'];
  radius: BlockStyle['radius'];
  onBorder: (v: BlockStyle['border']) => void;
  onRadius: (v: BlockStyle['radius']) => void;
}) {
  const t = useT();
  const b = border ?? {};
  const setB = (patch: Partial<NonNullable<BlockStyle['border']>>) => {
    const next = { ...b, ...patch };
    const empty = next.width == null && !next.color && !next.style;
    onBorder(empty ? undefined : next);
  };

  const linked = typeof radius === 'number' || radius == null;
  const corners = typeof radius === 'object' && radius ? radius : {};
  const setCorner = (key: (typeof RADIUS_CORNERS)[number]['key'], raw: string) => {
    const next = { ...corners, [key]: raw === '' ? undefined : Number(raw) };
    const empty = RADIUS_CORNERS.every((c) => next[c.key] == null);
    onRadius(empty ? undefined : next);
  };

  return (
    <div className="pb-field">
      <Label>{t('pageBuilder.style.border')}</Label>
      <div className="pb-grid3">
        <Input
          type="number"
          placeholder={t('pageBuilder.style.border.width')}
          value={b.width ?? ''}
          onChange={(e) => setB({ width: e.target.value === '' ? undefined : Number(e.target.value) })}
        />
        <Select
          value={b.style ?? 'solid'}
          options={[
            { value: 'solid', label: t('pageBuilder.style.border.solid') },
            { value: 'dashed', label: t('pageBuilder.style.border.dashed') },
            { value: 'dotted', label: t('pageBuilder.style.border.dotted') },
          ]}
          onChange={(e) => setB({ style: e.target.value as NonNullable<BlockStyle['border']>['style'] })}
        />
        <ColorField label="" value={b.color ?? ''} onChange={(v) => setB({ color: v || undefined })} />
      </div>

      <div className="pb-radius__head">
        <Label>{t('pageBuilder.style.radius')}</Label>
        <Switch
          checked={!linked}
          onChange={(perCorner) => onRadius(perCorner ? { topLeft: typeof radius === 'number' ? radius : undefined } : undefined)}
          label={t('pageBuilder.style.radius.perCorner')}
        />
      </div>
      {linked ? (
        <Input
          type="number"
          placeholder={t('pageBuilder.style.radius')}
          value={typeof radius === 'number' ? radius : ''}
          onChange={(e) => onRadius(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      ) : (
        <div className="pb-spacing">
          {RADIUS_CORNERS.map((c) => (
            <label key={c.key} className="pb-spacing__edge">
              <span>{t(c.labelKey)}</span>
              <Input type="number" value={corners[c.key] ?? ''} onChange={(e) => setCorner(c.key, e.target.value)} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const EDGES: { key: keyof BoxSpacing; labelKey: string }[] = [
  { key: 'top', labelKey: 'pageBuilder.spacing.top' },
  { key: 'right', labelKey: 'pageBuilder.spacing.right' },
  { key: 'bottom', labelKey: 'pageBuilder.spacing.bottom' },
  { key: 'left', labelKey: 'pageBuilder.spacing.left' },
];

const SPACING_UNITS: BoxSpacing['unit'][] = ['px', 'rem', '%', 'vw'];

function SpacingControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: BoxSpacing | undefined;
  onChange: (next: BoxSpacing | undefined) => void;
}) {
  const t = useT();
  const v = value ?? {};
  // A box with no edges AND the default unit carries no spacing → store nothing.
  const isEmpty = (b: BoxSpacing) =>
    EDGES.every((e) => b[e.key] == null) && (b.unit == null || b.unit === 'px');
  const commit = (next: BoxSpacing) => onChange(isEmpty(next) ? undefined : next);
  const set = (edge: keyof BoxSpacing, raw: string) => {
    commit({ ...v, [edge]: raw === '' ? undefined : Number(raw) });
  };
  const setUnit = (unit: string) => {
    // Keep px implicit (absent) so pre-unit saves stay byte-identical.
    commit({ ...v, unit: unit === 'px' ? undefined : (unit as BoxSpacing['unit']) });
  };
  return (
    <div className="pb-field">
      <div className="pb-spacing__head">
        <Label>{label}</Label>
        <Select
          value={v.unit ?? 'px'}
          options={SPACING_UNITS.map((u) => ({ value: u as string, label: u as string }))}
          onChange={(e) => setUnit(e.target.value)}
          aria-label={t('pageBuilder.style.spacingUnit')}
        />
      </div>
      <div className="pb-spacing">
        {EDGES.map((e) => (
          <label key={e.key} className="pb-spacing__edge">
            <span>{t(e.labelKey)}</span>
            <Input type="number" value={v[e.key] ?? ''} onChange={(ev) => set(e.key, ev.target.value)} />
          </label>
        ))}
      </div>
    </div>
  );
}
