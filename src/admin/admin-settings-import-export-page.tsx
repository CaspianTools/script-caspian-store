'use client';

import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { useT } from '../i18n/locale-context';
import { useToast } from '../ui/toast';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { Table, TBody, TD, TH, THead, TR } from '../ui/table';
import { DownloadIcon, UploadIcon } from '../ui/icons';
import { toCsv, parseCsv, csvToRecords } from '../utils/csv';
import {
  exportableDatasets,
  getDataset,
  importableDatasets,
} from '../services/import-export/catalog';
import type { ImportSummary, RowAction, RowPlan } from '../services/import-export/types';

const card: CSSProperties = {
  border: '1px solid var(--a-line, #e6e6e6)',
  borderRadius: 'var(--a-r-lg, 12px)',
  background: 'var(--a-panel, #fff)',
  boxShadow: 'var(--a-shadow, 0 1px 2px rgba(0,0,0,0.04))',
  padding: 20,
};
const muted: CSSProperties = { color: '#666', fontSize: 13, margin: '4px 0 0' };
const fieldLabel: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 };

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminSettingsImportExportPage({ className }: { className?: string }) {
  const { db } = useCaspianFirebase();
  const t = useT();
  const { toast } = useToast();

  const exportList = useMemo(() => exportableDatasets(), []);
  const importList = useMemo(() => importableDatasets(), []);

  const [exportId, setExportId] = useState<string>(exportList[0]?.id ?? 'products');
  const [exporting, setExporting] = useState(false);

  const [importId, setImportId] = useState<string>(importList[0]?.id ?? 'products');
  const [fileName, setFileName] = useState('');
  const [missingCols, setMissingCols] = useState<string[]>([]);
  const [plans, setPlans] = useState<RowPlan[] | null>(null);
  const [actions, setActions] = useState<Record<number, RowAction>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportDesc = getDataset(exportId);
  const importDesc = getDataset(importId);

  const handleExport = async () => {
    if (!exportDesc) return;
    setExporting(true);
    try {
      const matrix = await exportDesc.exportMatrix(db);
      const headers = exportDesc.columns.map((c) => c.header);
      downloadCsv(`${exportDesc.id}-${todayStr()}.csv`, toCsv([headers, ...matrix]));
      toast({
        title:
          matrix.length === 0
            ? t('admin.importExport.export.empty')
            : t('admin.importExport.export.done'),
      });
    } catch (err) {
      console.error('[caspian-store] Export failed:', err);
      toast({ title: t('admin.importExport.export.failed'), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleTemplate = () => {
    if (!importDesc) return;
    const headers = importDesc.columns.map((c) => c.header);
    const sample = importDesc.columns.map((c) => c.sample);
    downloadCsv(`${importDesc.id}-template.csv`, toCsv([headers, sample]));
  };

  const resetImport = () => {
    setFileName('');
    setMissingCols([]);
    setPlans(null);
    setActions({});
    setSummary(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const onImportDatasetChange = (id: string) => {
    setImportId(id);
    resetImport();
  };

  const handleFile = async (file: File) => {
    if (!importDesc?.analyzeRows) return;
    resetImport();
    setFileName(file.name);
    try {
      const text = await file.text();
      const matrix = parseCsv(text);
      const headerRow = (matrix[0] ?? []).map((h) => h.trim());
      const present = new Set(headerRow);
      const required = importDesc.columns.filter((c) => c.required).map((c) => c.header);
      const missing = required.filter((h) => !present.has(h));
      if (missing.length > 0) {
        setMissingCols(missing);
        return;
      }
      const records = csvToRecords(matrix);
      if (records.length === 0) {
        toast({ title: t('admin.importExport.import.fileEmpty') });
        return;
      }
      setAnalyzing(true);
      const result = await importDesc.analyzeRows(db, records);
      setPlans(result);
      const init: Record<number, RowAction> = {};
      for (const p of result) init[p.row] = p.defaultAction;
      setActions(init);
    } catch (err) {
      console.error('[caspian-store] Analyze failed:', err);
      toast({ title: t('admin.importExport.export.failed'), variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const setRowAction = (row: number, action: RowAction) =>
    setActions((prev) => ({ ...prev, [row]: action }));

  const duplicates = useMemo(() => plans?.filter((p) => p.kind === 'duplicate') ?? [], [plans]);
  const invalids = useMemo(() => plans?.filter((p) => p.kind === 'invalid') ?? [], [plans]);
  const counts = useMemo(() => {
    if (!plans) return null;
    return {
      newCount: plans.filter((p) => p.kind === 'new').length,
      dupCount: duplicates.length,
      invalidCount: invalids.length,
    };
  }, [plans, duplicates, invalids]);

  const dupActionOptions = useMemo(
    () => Array.from(new Set(duplicates.flatMap((p) => p.allowedActions))),
    [duplicates],
  );

  const applyAllDuplicates = (action: string) => {
    if (!action) return;
    setActions((prev) => {
      const next = { ...prev };
      for (const p of duplicates) {
        if (p.allowedActions.includes(action as RowAction)) next[p.row] = action as RowAction;
      }
      return next;
    });
  };

  const handleRun = async () => {
    if (!importDesc?.applyRows || !plans) return;
    setRunning(true);
    try {
      const decided = plans.map((plan) => ({
        plan,
        action: actions[plan.row] ?? plan.defaultAction,
      }));
      const result = await importDesc.applyRows(db, decided);
      setSummary(result);
      setPlans(null);
      toast({
        title: t('admin.importExport.summary.title'),
        description:
          `${t('admin.importExport.summary.created')}: ${result.created} · ` +
          `${t('admin.importExport.summary.updated')}: ${result.updated} · ` +
          `${t('admin.importExport.summary.skipped')}: ${result.skipped} · ` +
          `${t('admin.importExport.summary.errors')}: ${result.errors}`,
      });
    } catch (err) {
      console.error('[caspian-store] Import failed:', err);
      toast({ title: t('admin.importExport.export.failed'), variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={className}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {t('admin.importExport.title')}
        </h1>
        <p style={muted}>{t('admin.importExport.subtitle')}</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 880 }}>
        {/* Export */}
        <section style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            {t('admin.importExport.export.heading')}
          </h2>
          <p style={muted}>{t('admin.importExport.export.desc')}</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
            <label>
              <span style={fieldLabel}>{t('admin.importExport.export.dataset')}</span>
              <Select
                value={exportId}
                onChange={(e) => setExportId(e.target.value)}
                options={exportList.map((d) => ({ value: d.id, label: t(d.labelKey) }))}
              />
            </label>
            <Button variant="outline" onClick={handleExport} loading={exporting}>
              <DownloadIcon size={16} /> {t('admin.importExport.export.download')}
            </Button>
          </div>
          {exportDesc && <p style={muted}>{t(exportDesc.descriptionKey)}</p>}
        </section>

        {/* Import */}
        <section style={card}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
            {t('admin.importExport.import.heading')}
          </h2>
          <p style={muted}>{t('admin.importExport.import.desc')}</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
            <label>
              <span style={fieldLabel}>{t('admin.importExport.import.dataset')}</span>
              <Select
                value={importId}
                onChange={(e) => onImportDatasetChange(e.target.value)}
                options={importList.map((d) => ({ value: d.id, label: t(d.labelKey) }))}
              />
            </label>
            <Button variant="outline" onClick={handleTemplate}>
              <DownloadIcon size={16} /> {t('admin.importExport.import.template')}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <UploadIcon size={16} /> {t('admin.importExport.import.choose')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
          {fileName && <p style={muted}>{fileName}</p>}

          {/* Column reference */}
          {importDesc && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {t('admin.importExport.import.columns')}
              </summary>
              <div style={{ marginTop: 8 }}>
                <Table>
                  <THead>
                    <TR>
                      <TH>{t('admin.importExport.import.columnHeader')}</TH>
                      <TH>{t('admin.importExport.import.required')}</TH>
                      <TH>{t('admin.importExport.import.columnHelp')}</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {importDesc.columns.map((c) => (
                      <TR key={c.header}>
                        <TD style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.header}</TD>
                        <TD style={{ color: c.required ? '#b45309' : '#999' }}>
                          {c.required
                            ? t('admin.importExport.import.required')
                            : t('admin.importExport.import.optional')}
                        </TD>
                        <TD style={{ color: '#666', fontSize: 13 }}>{c.help ?? ''}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            </details>
          )}

          {missingCols.length > 0 && (
            <p style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>
              {t('admin.importExport.import.missingColumns', { columns: missingCols.join(', ') })}
            </p>
          )}

          {analyzing && <p style={muted}>{t('admin.importExport.import.analyzing')}</p>}

          {plans && counts && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>
                {t('admin.importExport.import.summaryLine', {
                  newCount: counts.newCount,
                  dupCount: counts.dupCount,
                  invalidCount: counts.invalidCount,
                })}
              </p>

              {invalids.length > 0 && (
                <details style={{ marginBottom: 12 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 13, color: '#b91c1c' }}>
                    {t('admin.importExport.import.invalidRows', { count: invalids.length })}
                  </summary>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: '#666' }}>
                    {invalids.map((p) => (
                      <li key={p.row}>
                        {t('admin.importExport.col.row')} {p.row}
                        {p.summary ? ` (${p.summary})` : ''}: {p.error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {duplicates.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                      marginBottom: 8,
                    }}
                  >
                    <strong style={{ fontSize: 14 }}>
                      {t('admin.importExport.import.duplicates')}
                    </strong>
                    <label style={{ fontSize: 13, color: '#666', display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      {t('admin.importExport.import.applyAll')}
                      <Select
                        value=""
                        onChange={(e) => applyAllDuplicates(e.target.value)}
                        options={[
                          { value: '', label: '—' },
                          ...dupActionOptions.map((a) => ({
                            value: a,
                            label: t(`admin.importExport.action.${a}`),
                          })),
                        ]}
                      />
                    </label>
                  </div>
                  <Table>
                    <THead>
                      <TR>
                        <TH style={{ width: 60 }}>{t('admin.importExport.col.row')}</TH>
                        <TH>{t('admin.importExport.col.item')}</TH>
                        <TH style={{ width: 180 }}>{t('admin.importExport.col.action')}</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {duplicates.map((p) => (
                        <TR key={p.row}>
                          <TD style={{ color: '#888' }}>{p.row}</TD>
                          <TD style={{ fontWeight: 500 }}>{p.summary}</TD>
                          <TD>
                            <Select
                              value={actions[p.row] ?? p.defaultAction}
                              onChange={(e) => setRowAction(p.row, e.target.value as RowAction)}
                              options={p.allowedActions.map((a) => ({
                                value: a,
                                label: t(`admin.importExport.action.${a}`),
                              }))}
                            />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}

              <Button onClick={handleRun} loading={running}>
                {t('admin.importExport.import.run')}
              </Button>
            </div>
          )}

          {summary && (
            <div style={{ marginTop: 16 }}>
              <strong style={{ fontSize: 14 }}>{t('admin.importExport.summary.title')}</strong>
              <p style={{ fontSize: 13, color: '#444', margin: '6px 0 0' }}>
                {t('admin.importExport.summary.created')}: {summary.created} ·{' '}
                {t('admin.importExport.summary.updated')}: {summary.updated} ·{' '}
                {t('admin.importExport.summary.skipped')}: {summary.skipped} ·{' '}
                {t('admin.importExport.summary.errors')}: {summary.errors}
              </p>
              {summary.errors > 0 && (
                <div style={{ marginTop: 10 }}>
                  <Table>
                    <THead>
                      <TR>
                        <TH style={{ width: 60 }}>{t('admin.importExport.col.row')}</TH>
                        <TH>{t('admin.importExport.col.message')}</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {summary.results
                        .filter((r) => r.status === 'error')
                        .map((r) => (
                          <TR key={r.row}>
                            <TD style={{ color: '#888' }}>{r.row}</TD>
                            <TD style={{ color: '#b91c1c', fontSize: 13 }}>{r.message}</TD>
                          </TR>
                        ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
