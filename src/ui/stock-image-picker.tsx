'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { useCaspianFirebase } from '../provider/caspian-store-provider';
import { uploadAdminImage } from '../services/storage-service';
import {
  searchStockImages,
  fetchStockImageFile,
  type StockImageSearchOptions,
} from '../services/stock-image-service';
import type { StockImageAttribution, StockImageResult } from '../types';
import { Button } from './button';
import { Dialog } from './dialog';
import { Input, Label } from './input';
import { Select } from './select';
import { useToast } from './toast';

export interface StockImagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Storage path prefix for the re-uploaded asset. */
  storagePath: string;
  /** Called with the uploaded Storage URL + the image's attribution. */
  onSelect: (url: string, attribution: StockImageAttribution) => void;
}

const LICENSE_FILTERS: Record<string, StockImageSearchOptions> = {
  commercial: { licenseType: 'commercial,modification' },
  cc0: { license: 'cc0' },
};

/**
 * Searches Openverse (via the `/api/stock-images` proxy) and inserts a chosen
 * openly-licensed image — downloading its bytes through the proxy and
 * re-uploading to Firebase Storage so the store owns the asset. Captures the
 * image's attribution (a legal requirement for CC-BY licenses).
 */
export function StockImagePicker({ open, onOpenChange, storagePath, onSelect }: StockImagePickerProps) {
  const t = useT();
  const { storage, auth, functions } = useCaspianFirebase();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [license, setLicense] = useState<keyof typeof LICENSE_FILTERS>('commercial');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<StockImageResult[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [insertingId, setInsertingId] = useState<string | null>(null);

  // Debounce typing (Openverse anon throttles to ~1 req/s).
  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 500);
    return () => clearTimeout(id);
  }, [query]);

  // Run the search whenever the query, page, or license changes.
  const reqRef = useRef(0);
  useEffect(() => {
    if (!debounced) {
      setResults([]);
      setPageCount(0);
      return;
    }
    const seq = ++reqRef.current;
    setLoading(true);
    setError(false);
    const run = async () => {
      const tok = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
      return searchStockImages(debounced, page, LICENSE_FILTERS[license], tok);
    };
    run()
      .then((res) => {
        if (seq !== reqRef.current) return;
        setResults((prev) => (page > 1 ? [...prev, ...res.results] : res.results));
        setPageCount(res.pageCount);
      })
      .catch(() => seq === reqRef.current && setError(true))
      .finally(() => seq === reqRef.current && setLoading(false));
  }, [debounced, page, license, auth]);

  const handleSelect = async (r: StockImageResult) => {
    setInsertingId(r.id);
    try {
      const tok = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
      const file = await fetchStockImageFile(r.fullUrl, r.title || 'stock', tok);
      const ext = file.name.split('.').pop() || 'jpg';
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${storagePath.replace(/\/$/, '')}/${Date.now()}-${rand}.${ext}`;
      const url = await uploadAdminImage({ storage, auth, functions, path, file });
      onSelect(url, r.attribution);
      toast({ title: t('stockImage.inserted') });
      onOpenChange(false);
    } catch (err) {
      console.error('[caspian-store] Stock image insert failed:', err);
      toast({ title: t('stockImage.error'), variant: 'destructive' });
    } finally {
      setInsertingId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('stockImage.title')}
      description={t('stockImage.attributionNotice')}
      maxWidth={760}
    >
      <div className="pb-stock">
        <div className="pb-stock__bar">
          <Input
            autoFocus
            value={query}
            placeholder={t('stockImage.placeholder')}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div>
            <Label style={{ display: 'none' }}>{t('stockImage.licenseFilter')}</Label>
            <Select
              value={license}
              options={[
                { value: 'commercial', label: t('stockImage.license.commercial') },
                { value: 'cc0', label: t('stockImage.license.cc0') },
              ]}
              onChange={(e) => {
                setLicense(e.target.value as keyof typeof LICENSE_FILTERS);
                setPage(1);
              }}
            />
          </div>
        </div>

        {error ? (
          <p className="pb-stock__state">{t('stockImage.error')}</p>
        ) : !debounced ? (
          <p className="pb-stock__state">{t('stockImage.prompt')}</p>
        ) : results.length === 0 && !loading ? (
          <p className="pb-stock__state">{t('stockImage.noResults')}</p>
        ) : (
          <>
            <div className="pb-stock__grid">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="pb-stock__item"
                  title={r.title}
                  disabled={insertingId !== null}
                  onClick={() => void handleSelect(r)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumbUrl} alt={r.title} loading="lazy" />
                  {r.attribution.license && (
                    <span className="pb-stock__badge">{r.attribution.license}</span>
                  )}
                </button>
              ))}
            </div>
            {loading && <p className="pb-stock__state">{t('common.loading')}</p>}
            {!loading && page < pageCount && (
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)}>
                {t('stockImage.loadMore')}
              </Button>
            )}
          </>
        )}
        <p className="pb-stock__notice">{t('stockImage.poweredBy')}</p>
      </div>
    </Dialog>
  );
}
