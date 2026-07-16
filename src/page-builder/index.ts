// Homepage page-builder / inline editor (v9.3). Catalog + renderer are
// server-safe; the editor surface is 'use client'.
export {
  BLOCK_CATALOG,
  SECTION_CATALOG,
  HOME_SECTION_ORDER,
  blockCategoryOf,
  getBlockType,
  listBlockTypes,
  listBlockTypesByCategory,
  getSectionType,
  listSectionTypes,
} from './catalog';
export { buildDefaultHomeLayout } from './home-default-layout';
export { BlockRenderer, type BlockRendererProps } from './block-renderer';
export {
  HomeSectionRenderer,
  useHomeLayout,
  HOME_PAGE_ID,
  type HomeSectionRendererProps,
  type UseHomeLayoutResult,
} from './home-section-renderer';
export {
  SectionEditProvider,
  useSectionEdit,
  type SectionEditValue,
} from './section-edit-context';
export { EditableText, EditableImage, type EditableTextProps, type EditableImageProps } from './editor/editable';
export {
  HomeEditorProvider,
  useHomeEditor,
  useHomeEditorOptional,
  type HomeEditorValue,
} from './editor/home-editor-context';
export { HomeEditorChrome } from './editor/home-editor-chrome';
export {
  type SectionType,
  type SectionField,
  type SectionFieldType,
  type SectionVariant,
  type SectionComponentProps,
  type BlockType,
  type BlockField,
  type BlockFieldType,
  type BlockCategory,
  type BlockComponentProps,
} from './types';
