'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../../context/auth-context';
import { useCaspianFirebase } from '../../provider/caspian-store-provider';
import { getSiteSettings } from '../../services/site-settings-service';
import {
  LayoutConflictError,
  discardDraft as discardDraftLayout,
  getDraftLayout,
  getPageLayout,
  publishLayout,
  saveDraftLayout,
} from '../../services/page-layout-service';
import { getBuilderPage, updateBuilderPage } from '../../services/builder-page-service';
import type { BlockStyle, Breakpoint, PageBlock, SiteSettings } from '../../types';
import { useToast } from '../../ui/toast';
import { useT } from '../../i18n';
import { getBlockType } from '../catalog';
import { cloneWithNewIds, createBlock } from '../block-factory';
import {
  CONTAINER_PREFIX,
  ROOT_ID,
  anyBlock,
  findBlock,
  findParentId,
  getChildren,
  insertInto,
  isSelfOrDescendant,
  mapBlock,
  removeBlock as removeBlockFromTree,
} from '../block-tree';
import { buildDefaultHomeLayout } from '../home-default-layout';
import { HOME_PAGE_ID } from '../home-section-renderer';
import { CanvasDndProvider } from './canvas-dnd';

/** Flip a custom page's route status to published on its first publish. */
async function ensurePageRoutePublished(db: Parameters<typeof getBuilderPage>[0], pageId: string): Promise<void> {
  if (pageId === HOME_PAGE_ID) return;
  const page = await getBuilderPage(db, pageId);
  if (page && page.status !== 'published') await updateBuilderPage(db, pageId, { status: 'published' });
}

const UNDO_LIMIT = 30;
/** Rapid same-target edits within this window fold into one undo entry. */
const COALESCE_MS = 500;
/** Debounce idle before an autosave write. */
const AUTOSAVE_MS = 2500;

export interface HomeEditorValue {
  isAdmin: boolean;
  loading: boolean;
  /** The page this editor edits (`pageLayouts/{pageId}`); `home` by default. */
  pageId: string;
  siteSettings: SiteSettings | null;
  /** The block tree to render right now — draft while editing, else saved/seed. */
  blocks: PageBlock[];

  isEditing: boolean;
  enterEdit: () => void;
  /** Leave edit mode, discarding the working draft (save first to keep edits). */
  exitEdit: () => void;

  selectedId: string | null;
  select: (id: string | null) => void;
  /** Bumps on every `select()` call (even re-selecting the same id). */
  selectionNonce: number;

  /** Device the Style tab edits + the canvas previews. */
  breakpoint: Breakpoint;
  setBreakpoint: (bp: Breakpoint) => void;

  dirty: boolean;
  saving: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** True while an autosave write is in flight (distinct from a manual `save`). */
  autosaving: boolean;
  /** A block subtree is on the clipboard, so `pasteBlock` will do something. */
  canPaste: boolean;

  updateField: (id: string, key: string, value: unknown) => void;
  setVisible: (id: string, visible: boolean) => void;
  setVariant: (id: string, variant: string) => void;
  /**
   * Replace a block's visual style for the active breakpoint: the base `style`
   * on desktop, else that breakpoint's `responsive` override.
   */
  setStyle: (id: string, style: BlockStyle) => void;
  /** Show/hide a block on the active (non-desktop) breakpoint. */
  setDeviceHidden: (id: string, hidden: boolean) => void;
  /**
   * Drag-drop: move `activeId` to sit before block `overId`, or — when `overId`
   * is a `container:<id>` droppable — append it into that container. Handles
   * reorder and cross-container moves; cycles are rejected.
   */
  dropBlock: (activeId: string, overId: string) => void;
  /**
   * Insert a catalog block. Lands as the last child of the selected block when
   * that block is a container; otherwise as the selected block's next sibling;
   * otherwise at the end of the page.
   */
  insertBlock: (type: string) => void;
  /**
   * Insert a NEW catalog block relative to a drop target (canvas drag-from-
   * library). `overId` is a block id (insert before it) or a `container:<id>`
   * droppable (append into it).
   */
  insertNewBlock: (type: string, overId: string) => void;
  /** Set by the canvas DnD provider during a drag, to suppress autosave. */
  setDragging: (dragging: boolean) => void;
  /** Duplicate a block (and its subtree) in place, as its next sibling. */
  duplicateBlock: (id: string) => void;
  /** Copy a block subtree to the in-memory clipboard. */
  copyBlock: (id: string) => void;
  /**
   * Paste the clipboard subtree (fresh ids). Lands into `targetId` when it's a
   * container, else as its next sibling, else at the end of the page. Defaults
   * to the current selection.
   */
  pasteBlock: (targetId?: string | null) => void;
  removeBlock: (id: string) => void;
  undo: () => void;
  redo: () => void;
  resetToDefault: () => void;
  /** Save the working draft (does NOT publish to shoppers). */
  save: () => Promise<void>;
  /** True when a saved draft holds edits not yet published. */
  hasUnpublishedChanges: boolean;
  /** Publish the current draft to the live page (snapshots a revision). */
  publish: () => Promise<void>;
  /** Discard the saved draft and revert the working copy to the published layout. */
  discardDraft: () => Promise<void>;
  /** Replace the working draft with a revision's blocks (preview, then publish). */
  restoreRevisionBlocks: (blocks: PageBlock[]) => void;
  /** Non-null when a concurrent save/publish was rejected; drives the conflict bar. */
  conflict: { by?: string; kind: 'draft' | 'publish' } | null;
  /** Discard local edits and reload the latest from Firestore. */
  resolveConflictReload: () => Promise<void>;
  /** Force the pending save/publish over the concurrent write. */
  resolveConflictOverwrite: () => Promise<void>;
}

const HomeEditorContext = createContext<HomeEditorValue | null>(null);

const clone = (s: PageBlock[]): PageBlock[] => JSON.parse(JSON.stringify(s)) as PageBlock[];

export function HomeEditorProvider({
  children,
  pageId = HOME_PAGE_ID,
}: {
  children: ReactNode;
  /** Which `pageLayouts/{pageId}` doc this editor edits. Defaults to the homepage. */
  pageId?: string;
}) {
  const { db } = useCaspianFirebase();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const t = useT();
  const isAdmin = userProfile?.role === 'admin';

  // Load the PUBLISHED layout (what shoppers see) and any saved DRAFT together.
  // `saved` is the published blocks; `draftBlocks` is the last-saved draft (null
  // = none). The refs carry the concurrency bases (published version / draft rev).
  const [saved, setSaved] = useState<PageBlock[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftBlocks, setDraftBlocks] = useState<PageBlock[] | null>(null);
  const baseDraftRevRef = useRef(0);
  const publishedVersionRef = useRef(0);
  const [conflict, setConflict] = useState<{ by?: string; kind: 'draft' | 'publish' } | null>(null);

  useEffect(() => {
    let alive = true;
    const seed = () => (pageId === HOME_PAGE_ID ? buildDefaultHomeLayout() : []);
    setLoading(true);
    Promise.all([getPageLayout(db, pageId), getDraftLayout(db, pageId)])
      .then(([pub, draft]) => {
        if (!alive) return;
        setSaved(pub ? pub.blocks : seed());
        publishedVersionRef.current = pub?.version ?? 0;
        setDraftBlocks(draft?.blocks ?? null);
        baseDraftRevRef.current = draft?.draftRev ?? 0;
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setSaved(seed());
        setDraftBlocks(null);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [db, pageId]);

  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  useEffect(() => {
    let alive = true;
    getSiteSettings(db)
      .then((s) => alive && setSiteSettings(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [db]);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PageBlock[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionNonce, setSelectionNonce] = useState(0);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  // Undo/redo: symmetric snapshot stacks with the live `draft` as pivot. Text
  // edits within COALESCE_MS under the same coalesce key fold into one history
  // entry so typing doesn't shred the buffer one keystroke at a time.
  const past = useRef<PageBlock[][]>([]);
  const future = useRef<PageBlock[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const lastKeyRef = useRef<string | null>(null);
  const lastTimeRef = useRef(0);
  // Clipboard for copy/paste — a detached subtree; paste regenerates ids.
  const clipboard = useRef<PageBlock | null>(null);
  const [canPaste, setCanPaste] = useState(false);
  // Autosave: one in-flight guard shared by manual + auto writes, a drag guard
  // (set by the canvas DnD provider) to suppress autosave mid-drag, and the
  // debounce timer.
  const savingRef = useRef(false);
  const draggingRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selecting bumps a nonce so the panel can react even when the same block is
  // re-selected (e.g. clicking it on the canvas again to reopen its settings).
  // Ending the coalesce run here stops a text-edit run from folding across a
  // change of selection.
  const select = useCallback((id: string | null) => {
    lastKeyRef.current = null;
    setSelectedId(id);
    setSelectionNonce((n) => n + 1);
  }, []);

  // Mirror `draft` in a ref so mutations push history without putting side
  // effects inside a state updater (which would double-run under StrictMode).
  const draftRef = useRef<PageBlock[] | null>(null);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Mirror `selectedId` so callbacks can read it without re-creating on change.
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Mirror the active breakpoint so style callbacks stay stable.
  const bpRef = useRef<Breakpoint>('desktop');
  useEffect(() => {
    bpRef.current = breakpoint;
  }, [breakpoint]);

  const mutate = useCallback((fn: (blocks: PageBlock[]) => PageBlock[], coalesceKey?: string) => {
    const current = draftRef.current;
    if (!current) return;
    const now = Date.now();
    // Fold into the previous entry only for a same-key run within the window;
    // the FIRST edit of a run still snapshots the pre-edit tree, so one undo
    // restores the whole value. Any structural op (no key) is always discrete.
    const coalesce =
      coalesceKey != null && coalesceKey === lastKeyRef.current && now - lastTimeRef.current < COALESCE_MS;
    if (!coalesce) {
      past.current = [...past.current.slice(-(UNDO_LIMIT - 1)), clone(current)];
      future.current = [];
      setCanUndo(true);
      setCanRedo(false);
    }
    lastKeyRef.current = coalesceKey ?? null;
    lastTimeRef.current = now;
    const next = fn(clone(current));
    draftRef.current = next;
    setDraft(next);
    setDirty(true);
  }, []);

  const enterEdit = useCallback(() => {
    if (!isAdmin || !saved) return;
    // Resume a saved draft if one exists, else start from the published layout.
    const next = clone(draftBlocks ?? saved);
    draftRef.current = next;
    setDraft(next);
    setSelectedId(null);
    setDirty(false);
    past.current = [];
    future.current = [];
    lastKeyRef.current = null;
    setCanUndo(false);
    setCanRedo(false);
    setIsEditing(true);
  }, [isAdmin, saved, draftBlocks]);

  const exitEdit = useCallback(() => {
    setIsEditing(false);
    draftRef.current = null;
    setDraft(null);
    setSelectedId(null);
    past.current = [];
    future.current = [];
    lastKeyRef.current = null;
    setCanUndo(false);
    setCanRedo(false);
    setDirty(false);
  }, []);

  const updateField = useCallback(
    (id: string, key: string, value: unknown) => {
      const bp = bpRef.current;
      if (bp === 'desktop') {
        mutate(
          (blocks) => mapBlock(blocks, id, (b) => ({ ...b, props: { ...b.props, [key]: value } })),
          `field:${id}:${key}`,
        );
      } else {
        // Non-desktop edits write a per-breakpoint CONTENT override.
        mutate(
          (blocks) =>
            mapBlock(blocks, id, (b) => ({
              ...b,
              responsive: {
                ...b.responsive,
                [bp]: { ...b.responsive?.[bp], props: { ...b.responsive?.[bp]?.props, [key]: value } },
              },
            })),
          `field:${id}:${bp}:${key}`,
        );
      }
    },
    [mutate],
  );

  const setVisible = useCallback(
    (id: string, visible: boolean) => {
      mutate((blocks) => mapBlock(blocks, id, (b) => ({ ...b, visible })));
    },
    [mutate],
  );

  const setVariant = useCallback(
    (id: string, variant: string) => {
      mutate((blocks) => mapBlock(blocks, id, (b) => ({ ...b, variant })));
    },
    [mutate],
  );

  const setStyle = useCallback(
    (id: string, style: BlockStyle) => {
      const bp = bpRef.current;
      mutate(
        (blocks) =>
          mapBlock(blocks, id, (b) => {
            if (bp === 'desktop') return { ...b, style };
            return { ...b, responsive: { ...b.responsive, [bp]: { ...b.responsive?.[bp], style } } };
          }),
        // Coalesce rapid Style-tab scrubbing (color pickers, number inputs) into
        // one undo entry per block+device.
        `style:${id}:${bp}`,
      );
    },
    [mutate],
  );

  const setDeviceHidden = useCallback(
    (id: string, hidden: boolean) => {
      const bp = bpRef.current;
      if (bp === 'desktop') return;
      mutate((blocks) =>
        mapBlock(blocks, id, (b) => ({
          ...b,
          responsive: { ...b.responsive, [bp]: { ...b.responsive?.[bp], hidden } },
        })),
      );
    },
    [mutate],
  );

  const dropBlock = useCallback(
    (activeId: string, overId: string) => {
      if (activeId === overId) return;
      mutate((blocks) => {
        const active = findBlock(blocks, activeId);
        if (!active) return blocks;

        let targetParentId: string;
        let beforeId: string | null = null;
        if (overId.startsWith(CONTAINER_PREFIX)) {
          targetParentId = overId.slice(CONTAINER_PREFIX.length);
        } else {
          targetParentId = findParentId(blocks, overId) ?? ROOT_ID;
          beforeId = overId;
        }
        // Reject moving a container into itself or its own subtree.
        if (targetParentId !== ROOT_ID && isSelfOrDescendant(active, targetParentId)) return blocks;

        const { tree, removed } = removeBlockFromTree(blocks, activeId);
        if (!removed) return blocks;

        const siblings = getChildren(tree, targetParentId);
        let index = beforeId ? siblings.findIndex((b) => b.id === beforeId) : siblings.length;
        if (index < 0) index = siblings.length;
        return insertInto(tree, targetParentId, index, removed);
      });
    },
    [mutate],
  );

  const insertBlock = useCallback(
    (type: string) => {
      const block = createBlock(type);
      if (!block) return;
      mutate((blocks) => {
        const entry = getBlockType(type);
        if (entry?.singleton && anyBlock(blocks, (b) => b.type === type)) return blocks;

        const selId = selectedIdRef.current;
        const selBlock = selId ? findBlock(blocks, selId) : null;
        const selEntry = selBlock ? getBlockType(selBlock.type) : null;

        if (selBlock && selEntry?.acceptsChildren) {
          // Into the selected container, as its last child.
          const index = getChildren(blocks, selBlock.id).length;
          return insertInto(blocks, selBlock.id, index, block);
        }
        if (selBlock) {
          // As the selected block's next sibling.
          const parentId = findParentId(blocks, selBlock.id) ?? ROOT_ID;
          const siblings = getChildren(blocks, parentId);
          const index = siblings.findIndex((b) => b.id === selBlock.id) + 1;
          return insertInto(blocks, parentId, index, block);
        }
        return insertInto(blocks, ROOT_ID, blocks.length, block);
      });
      setSelectedId(block.id);
    },
    [mutate],
  );

  const insertNewBlock = useCallback(
    (type: string, overId: string) => {
      const block = createBlock(type);
      if (!block) return;
      mutate((blocks) => {
        const entry = getBlockType(type);
        if (entry?.singleton && anyBlock(blocks, (b) => b.type === type)) return blocks;
        if (overId.startsWith(CONTAINER_PREFIX)) {
          const parentId = overId.slice(CONTAINER_PREFIX.length);
          const index = getChildren(blocks, parentId).length;
          return insertInto(blocks, parentId, index, block);
        }
        const parentId = findParentId(blocks, overId) ?? ROOT_ID;
        const siblings = getChildren(blocks, parentId);
        const index = siblings.findIndex((b) => b.id === overId);
        return insertInto(blocks, parentId, index < 0 ? siblings.length : index, block);
      });
      setSelectedId(block.id);
    },
    [mutate],
  );

  const setDragging = useCallback((dragging: boolean) => {
    draggingRef.current = dragging;
  }, []);

  const duplicateBlock = useCallback(
    (id: string) => {
      let newId: string | null = null;
      mutate((blocks) => {
        const block = findBlock(blocks, id);
        if (!block) return blocks;
        // A singleton type may exist only once, so it can't be duplicated.
        if (getBlockType(block.type)?.singleton) return blocks;
        const copy = cloneWithNewIds(block);
        newId = copy.id;
        const parentId = findParentId(blocks, id) ?? ROOT_ID;
        const siblings = getChildren(blocks, parentId);
        const index = siblings.findIndex((b) => b.id === id) + 1;
        return insertInto(blocks, parentId, index, copy);
      });
      if (newId) setSelectedId(newId);
    },
    [mutate],
  );

  const copyBlock = useCallback((id: string) => {
    const current = draftRef.current;
    if (!current) return;
    const block = findBlock(current, id);
    if (!block) return;
    // Detach a deep copy; paste regenerates ids so repeated pastes differ.
    clipboard.current = clone([block])[0];
    setCanPaste(true);
  }, []);

  const pasteBlock = useCallback(
    (targetId?: string | null) => {
      const src = clipboard.current;
      if (!src) return;
      let newId: string | null = null;
      mutate((blocks) => {
        const copy = cloneWithNewIds(src);
        const entry = getBlockType(copy.type);
        if (entry?.singleton && anyBlock(blocks, (b) => b.type === copy.type)) return blocks;
        newId = copy.id;
        const tId = targetId ?? selectedIdRef.current;
        const tBlock = tId ? findBlock(blocks, tId) : null;
        const tEntry = tBlock ? getBlockType(tBlock.type) : null;
        if (tBlock && tEntry?.acceptsChildren) {
          const index = getChildren(blocks, tBlock.id).length;
          return insertInto(blocks, tBlock.id, index, copy);
        }
        if (tBlock) {
          const parentId = findParentId(blocks, tBlock.id) ?? ROOT_ID;
          const siblings = getChildren(blocks, parentId);
          const index = siblings.findIndex((b) => b.id === tBlock.id) + 1;
          return insertInto(blocks, parentId, index, copy);
        }
        return insertInto(blocks, ROOT_ID, blocks.length, copy);
      });
      if (newId) setSelectedId(newId);
    },
    [mutate],
  );

  const removeBlock = useCallback(
    (id: string) => {
      mutate((blocks) => removeBlockFromTree(blocks, id).tree);
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [mutate],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    const cur = draftRef.current;
    if (cur) future.current.push(clone(cur));
    lastKeyRef.current = null;
    draftRef.current = prev;
    setDraft(prev);
    setDirty(true);
    setCanUndo(past.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    const cur = draftRef.current;
    if (cur) past.current.push(clone(cur));
    lastKeyRef.current = null;
    draftRef.current = next;
    setDraft(next);
    setDirty(true);
    setCanRedo(future.current.length > 0);
    setCanUndo(true);
  }, []);

  const resetToDefault = useCallback(() => {
    mutate(() => (pageId === HOME_PAGE_ID ? buildDefaultHomeLayout() : []));
  }, [mutate, pageId]);

  // Core write: saves the DRAFT (never the live page) without clearing undo
  // history (so undo survives a save) and without toasting on autosave, so both
  // the manual Save and the debounced autosave share one guarded path. `dirty`
  // is only cleared when the draft hasn't changed since the write started (an
  // edit landed mid-save ⇒ stay dirty so the next autosave picks it up). A
  // concurrent write by another admin raises the conflict bar instead.
  const persist = useCallback(
    async (blocks: PageBlock[], mode: 'manual' | 'auto') => {
      if (savingRef.current) return;
      savingRef.current = true;
      if (mode === 'manual') setSaving(true);
      else setAutosaving(true);
      try {
        const { draftRev } = await saveDraftLayout(db, pageId, blocks, {
          baseDraftRev: baseDraftRevRef.current,
          baseVersion: publishedVersionRef.current,
          uid: userProfile?.uid,
          name: userProfile?.displayName || userProfile?.email,
        });
        baseDraftRevRef.current = draftRev;
        setDraftBlocks(blocks);
        if (draftRef.current === blocks) setDirty(false);
        if (mode === 'manual') toast({ title: t('pageBuilder.draftSaved') });
      } catch (error) {
        if (error instanceof LayoutConflictError) {
          setConflict({ by: error.by, kind: 'draft' });
          toast({ title: t('pageBuilder.conflict.title'), variant: 'destructive' });
        } else {
          console.error('[caspian-store] Draft save failed:', error);
          if (mode === 'manual') toast({ title: t('pageBuilder.saveFailed'), variant: 'destructive' });
        }
      } finally {
        savingRef.current = false;
        setSaving(false);
        setAutosaving(false);
      }
    },
    [db, pageId, userProfile, toast, t],
  );

  const save = useCallback(async () => {
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    const current = draftRef.current;
    if (!current) return;
    await persist(current, 'manual');
  }, [persist]);

  // Debounced autosave: after the draft goes idle for AUTOSAVE_MS, flush it —
  // unless a write is already in flight or a drag is underway. Re-runs on every
  // edit (`draft` dep) so the timer resets, giving a true debounce.
  useEffect(() => {
    if (!isEditing || !dirty) return undefined;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      if (savingRef.current || draggingRef.current) return;
      const current = draftRef.current;
      if (current) void persist(current, 'auto');
    }, AUTOSAVE_MS);
    return () => {
      if (autosaveTimer.current) {
        clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [isEditing, dirty, draft, persist]);

  const publish = useCallback(async () => {
    const current = draftRef.current;
    if (!current) return;
    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
    setSaving(true);
    try {
      const { version } = await publishLayout(db, pageId, current, {
        baseVersion: publishedVersionRef.current,
        uid: userProfile?.uid,
        name: userProfile?.displayName || userProfile?.email,
      });
      publishedVersionRef.current = version;
      setSaved(clone(current));
      setDraftBlocks(null); // the draft was consumed by the publish
      baseDraftRevRef.current = 0;
      setDirty(false);
      await ensurePageRoutePublished(db, pageId).catch(() => {});
      toast({ title: t('pageBuilder.published') });
    } catch (error) {
      if (error instanceof LayoutConflictError) {
        setConflict({ by: error.by, kind: 'publish' });
        toast({ title: t('pageBuilder.conflict.title'), variant: 'destructive' });
      } else {
        console.error('[caspian-store] Publish failed:', error);
        toast({ title: t('pageBuilder.publishFailed'), variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  }, [db, pageId, userProfile, toast, t]);

  const discardDraft = useCallback(async () => {
    await discardDraftLayout(db, pageId).catch(() => {});
    setDraftBlocks(null);
    baseDraftRevRef.current = 0;
    // Revert the working copy to the published layout.
    if (saved) {
      const next = clone(saved);
      draftRef.current = next;
      setDraft(next);
      past.current = [];
      future.current = [];
      lastKeyRef.current = null;
      setCanUndo(false);
      setCanRedo(false);
      setDirty(false);
    }
  }, [db, pageId, saved]);

  const restoreRevisionBlocks = useCallback(
    (blocks: PageBlock[]) => {
      mutate(() => clone(blocks));
    },
    [mutate],
  );

  const resolveConflictReload = useCallback(async () => {
    const kind = conflict?.kind;
    setConflict(null);
    if (kind === 'publish') {
      const pub = await getPageLayout(db, pageId);
      setSaved(pub ? pub.blocks : []);
      publishedVersionRef.current = pub?.version ?? 0;
      return;
    }
    const draft = await getDraftLayout(db, pageId);
    baseDraftRevRef.current = draft?.draftRev ?? 0;
    setDraftBlocks(draft?.blocks ?? null);
    const base = draft?.blocks ?? saved ?? [];
    const next = clone(base);
    draftRef.current = next;
    setDraft(next);
    past.current = [];
    future.current = [];
    lastKeyRef.current = null;
    setCanUndo(false);
    setCanRedo(false);
    setDirty(false);
  }, [conflict, db, pageId, saved]);

  const resolveConflictOverwrite = useCallback(async () => {
    const kind = conflict?.kind;
    setConflict(null);
    if (kind === 'publish') {
      const pub = await getPageLayout(db, pageId);
      publishedVersionRef.current = pub?.version ?? 0;
      await publish();
      return;
    }
    const draft = await getDraftLayout(db, pageId);
    baseDraftRevRef.current = draft?.draftRev ?? 0;
    await save();
  }, [conflict, db, pageId, publish, save]);

  const blocks = isEditing && draft ? draft : saved ?? [];
  const hasUnpublishedChanges = draftBlocks !== null;

  const value = useMemo<HomeEditorValue>(
    () => ({
      isAdmin,
      loading: loading && saved === null,
      pageId,
      siteSettings,
      blocks,
      isEditing,
      enterEdit,
      exitEdit,
      selectedId,
      select,
      selectionNonce,
      breakpoint,
      setBreakpoint,
      dirty,
      saving,
      canUndo,
      canRedo,
      autosaving,
      canPaste,
      updateField,
      setVisible,
      setVariant,
      setStyle,
      setDeviceHidden,
      dropBlock,
      insertBlock,
      insertNewBlock,
      setDragging,
      duplicateBlock,
      copyBlock,
      pasteBlock,
      removeBlock,
      undo,
      redo,
      resetToDefault,
      save,
      hasUnpublishedChanges,
      publish,
      discardDraft,
      restoreRevisionBlocks,
      conflict,
      resolveConflictReload,
      resolveConflictOverwrite,
    }),
    [
      isAdmin, loading, saved, pageId, siteSettings, blocks, isEditing, enterEdit, exitEdit,
      selectedId, select, selectionNonce, breakpoint, dirty, saving, canUndo, canRedo, autosaving,
      canPaste, updateField, setVisible, setVariant, setStyle, setDeviceHidden, dropBlock,
      insertBlock, insertNewBlock, setDragging, duplicateBlock, copyBlock, pasteBlock, removeBlock,
      undo, redo, resetToDefault, save,
      hasUnpublishedChanges, publish, discardDraft, restoreRevisionBlocks, conflict,
      resolveConflictReload, resolveConflictOverwrite,
    ],
  );

  return (
    <HomeEditorContext.Provider value={value}>
      {isEditing ? <CanvasDndProvider>{children}</CanvasDndProvider> : children}
    </HomeEditorContext.Provider>
  );
}

export function useHomeEditor(): HomeEditorValue {
  const ctx = useContext(HomeEditorContext);
  if (!ctx) throw new Error('useHomeEditor must be called inside <HomeEditorProvider>.');
  return ctx;
}

/** Non-throwing variant — lets `<HomePageDefault>` work with or without the editor. */
export function useHomeEditorOptional(): HomeEditorValue | null {
  return useContext(HomeEditorContext);
}
