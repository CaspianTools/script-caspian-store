'use client';

import { createContext, useContext } from 'react';

/**
 * Per-section editing channel. The renderer wraps each section in a provider
 * carrying that instance's id + the editor callbacks; `<EditableText>` /
 * `<EditableImage>` inside the section consume it. Outside an editor (the
 * public storefront) the default value makes every primitive render plainly.
 */
export interface SectionEditValue {
  editing: boolean;
  sectionId: string;
  selected: boolean;
  /** Update one field's value on this section. No-op in view mode. */
  onFieldChange: (key: string, value: unknown) => void;
  /** Select this section in the editor (optionally focusing a field). */
  onSelect: (fieldKey?: string) => void;
}

const VIEW_ONLY: SectionEditValue = {
  editing: false,
  sectionId: '',
  selected: false,
  onFieldChange: () => {},
  onSelect: () => {},
};

const SectionEditContext = createContext<SectionEditValue | null>(null);

export const SectionEditProvider = SectionEditContext.Provider;

export function useSectionEdit(): SectionEditValue {
  return useContext(SectionEditContext) ?? VIEW_ONLY;
}
