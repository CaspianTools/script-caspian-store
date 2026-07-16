'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import {
  Button,
  ColorField,
  FocalPointField,
  ImageUploadField,
  Input,
  Label,
  RichTextEditor,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '../../ui';
import { getBlockType } from '../catalog';
import { findBlock } from '../block-tree';
import type { SectionField, SectionType } from '../types';
import type { PageBlock, StockImageAttribution } from '../../types';
import { useHomeEditor } from './home-editor-context';
import { InsertPanel } from './insert-panel';
import { BlockTreePanel } from './block-tree-panel';
import { StyleControls } from './style-controls';

type PanelTab = 'layers' | 'add' | 'settings';

/**
 * The Elementor-style side panel, organized into three tabs: **Layers** (the
 * drag-sortable block tree), **Add** (the block library), and **Settings** (the
 * selected block's Content / Style form). Selecting or inserting a block jumps
 * to Settings; the tab bar is sticky and the body scrolls.
 */
export function EditorPanel() {
  const t = useT();
  const {
    blocks,
    selectedId,
    selectionNonce,
    pageId,
    setVisible,
    removeBlock,
    duplicateBlock,
    copyBlock,
    pasteBlock,
    canPaste,
  } = useHomeEditor();
  const [tab, setTab] = useState<PanelTab>('add');
  const storagePath = `pageLayouts/${pageId}`;

  // Selecting / inserting a block surfaces its settings — keyed on the nonce so
  // re-selecting the same block (e.g. clicking it again on the canvas) re-opens.
  useEffect(() => {
    if (selectedId) setTab('settings');
  }, [selectedId, selectionNonce]);

  const selected = selectedId ? findBlock(blocks, selectedId) : null;
  const selectedEntry = selected ? getBlockType(selected.type) : null;

  return (
    <aside className="pb-panel" aria-label={t('pageBuilder.toolbar')}>
      <Tabs value={tab} defaultValue="add" onValueChange={(v) => setTab(v as PanelTab)}>
        <TabsList className="pb-panel__tabs">
          <TabsTrigger value="layers">{t('pageBuilder.tab.layers')}</TabsTrigger>
          <TabsTrigger value="add">{t('pageBuilder.tab.add')}</TabsTrigger>
          <TabsTrigger value="settings">{t('pageBuilder.tab.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="layers" className="pb-tab-body">
          <BlockTreePanel />
        </TabsContent>

        <TabsContent value="add" className="pb-tab-body">
          <InsertPanel />
        </TabsContent>

        <TabsContent value="settings" className="pb-tab-body">
          {selected && selectedEntry ? (
            <div className="pb-panel__section">
              <h3 className="pb-panel__title">{t(selectedEntry.nameKey)}</h3>
              {selectedEntry.dynamic && <p className="pb-panel__note">{t('pageBuilder.dynamicNote')}</p>}

              {selectedEntry.styleable === false ? (
                <ContentForm block={selected} entry={selectedEntry} storagePath={storagePath} />
              ) : (
                <Tabs defaultValue="content">
                  <TabsList>
                    <TabsTrigger value="content">{t('pageBuilder.tab.content')}</TabsTrigger>
                    <TabsTrigger value="style">{t('pageBuilder.tab.style')}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="content">
                    <ContentForm block={selected} entry={selectedEntry} storagePath={storagePath} />
                  </TabsContent>
                  <TabsContent value="style">
                    <StyleControls block={selected} storagePath={storagePath} />
                  </TabsContent>
                </Tabs>
              )}

              <div className="pb-field">
                <Switch
                  checked={selected.visible}
                  onChange={(v) => setVisible(selected.id, v)}
                  label={t('pageBuilder.visible')}
                />
              </div>

              <div className="pb-panel__actions">
                <Button variant="ghost" size="sm" onClick={() => duplicateBlock(selected.id)}>
                  {t('pageBuilder.duplicate')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => copyBlock(selected.id)}>
                  {t('pageBuilder.copy')}
                </Button>
                <Button variant="ghost" size="sm" disabled={!canPaste} onClick={() => pasteBlock(selected.id)}>
                  {t('pageBuilder.paste')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => removeBlock(selected.id)}>
                  {t('pageBuilder.remove')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="pb-panel__empty">{t('pageBuilder.selectABlock')}</p>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function ContentForm({
  block,
  entry,
  storagePath,
}: {
  block: PageBlock;
  entry: SectionType;
  storagePath: string;
}) {
  const t = useT();
  const { updateField, setVariant, breakpoint } = useHomeEditor();

  if (!entry.variants?.length && entry.fields.length === 0) {
    return <p className="pb-panel__note">{t('pageBuilder.noContentFields')}</p>;
  }

  // On tablet/mobile, fields read/write a per-breakpoint CONTENT override
  // (blank inherits from desktop); on desktop they edit the base props.
  const bpProps = breakpoint !== 'desktop' ? block.responsive?.[breakpoint]?.props : undefined;
  const valueFor = (key: string) => bpProps?.[key] ?? block.props[key] ?? entry.defaultProps[key];

  return (
    <>
      {breakpoint !== 'desktop' && <p className="pb-panel__note">{t('pageBuilder.style.deviceNote')}</p>}
      {entry.variants && entry.variants.length > 0 && (
        <div className="pb-field">
          <Label>{t('pageBuilder.variant')}</Label>
          <Select
            value={block.variant ?? entry.variants[0].id}
            options={entry.variants.map((v) => ({ value: v.id, label: t(v.labelKey) }))}
            onChange={(e) => setVariant(block.id, e.target.value)}
            style={{ width: '100%' }}
          />
        </div>
      )}
      {entry.fields.map((field) => (
        <FieldControl
          key={field.key}
          field={field}
          value={valueFor(field.key)}
          storagePath={storagePath}
          previewImageUrl={String(valueFor('imageUrl') ?? '')}
          onChange={(v) => updateField(block.id, field.key, v)}
          onAttribution={(attr) => updateField(block.id, 'imageAttribution', attr)}
        />
      ))}
    </>
  );
}

function FieldControl({
  field,
  value,
  storagePath,
  previewImageUrl,
  onChange,
  onAttribution,
}: {
  field: SectionField;
  value: unknown;
  storagePath: string;
  previewImageUrl?: string;
  onChange: (value: unknown) => void;
  onAttribution?: (attribution: StockImageAttribution | null) => void;
}) {
  const t = useT();
  const label = t(field.labelKey);
  const str = value == null ? '' : String(value);

  if (field.type === 'focal') {
    return (
      <FocalPointField
        label={label}
        value={str || '50% 50%'}
        imageUrl={previewImageUrl || undefined}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'image') {
    return (
      <div className="pb-field">
        <ImageUploadField
          label={label}
          value={str}
          storagePath={field.storagePath ?? storagePath}
          onChange={onChange}
          allowUrlFallback
          allowStockSearch
          onAttributionChange={onAttribution}
          aspectRatio="16 / 9"
          previewMaxWidth={280}
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="pb-field">
        <Label>{label}</Label>
        <Select
          value={str}
          options={(field.options ?? []).map((o) => ({ value: o.value, label: t(o.labelKey) }))}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
    );
  }

  if (field.type === 'link') {
    return (
      <div className="pb-field">
        <Label>{label}</Label>
        <Input
          type="text"
          value={str}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholderKey ? t(field.placeholderKey) : '/path or https://…'}
        />
      </div>
    );
  }

  if (field.type === 'richtext') {
    return (
      <div className="pb-field">
        <Label>{label}</Label>
        <RichTextEditor value={str} onChange={onChange} ariaLabel={label} />
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <div className="pb-field">
        <Label>{label}</Label>
        <Input
          type="number"
          value={str}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      </div>
    );
  }

  if (field.type === 'toggle') {
    return (
      <div className="pb-field">
        <Switch checked={Boolean(value)} onChange={onChange} label={label} />
      </div>
    );
  }

  if (field.type === 'color') {
    return <ColorField label={label} value={str} onChange={onChange} />;
  }

  return (
    <div className="pb-field">
      <Label>{label}</Label>
      {field.multiline ? (
        <Textarea value={str} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <Input value={str} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
