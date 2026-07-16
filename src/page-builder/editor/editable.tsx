'use client';

import {
  createElement,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { cn } from '../../utils/cn';
import { useSectionEdit } from '../section-edit-context';

type TextTag = 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'div' | 'em' | 'strong';

export interface EditableTextProps {
  /** Field key on the section's props. */
  fieldKey: string;
  value: string;
  /** Element to render. Match the original markup (e.g. 'p' for body copy). */
  as?: TextTag;
  className?: string;
  style?: CSSProperties;
  /** Allow Enter to insert newlines while editing. */
  multiline?: boolean;
  placeholder?: string;
}

/**
 * Renders a string. In view mode it emits exactly `<as>{value}</as>`, identical
 * to hardcoded markup. In edit mode the same element becomes `contentEditable`
 * and writes back through the section-edit channel. Initial/out-of-band value
 * sync follows the `RichTextEditor` pattern so typing never clobbers the caret.
 */
export function EditableText({
  fieldKey,
  value,
  as = 'span',
  className,
  style,
  multiline,
  placeholder,
}: EditableTextProps): ReactElement {
  const { editing, onFieldChange, onSelect } = useSectionEdit();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = ref.current;
    if (!el) return;
    const next = value ?? '';
    if (next !== el.textContent) {
      el.textContent = next;
    }
  }, [value, editing]);

  if (!editing) {
    return createElement(as, { className, style }, value);
  }

  const emit = (e: { currentTarget: HTMLElement }) => {
    onFieldChange(fieldKey, e.currentTarget.textContent ?? '');
  };

  return createElement(as, {
    ref,
    className: cn('pb-editable', className),
    style,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: false,
    'data-pb-placeholder': placeholder ?? '',
    onInput: emit,
    onBlur: emit,
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(fieldKey);
    },
    onFocus: () => onSelect(fieldKey),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!multiline && e.key === 'Enter') e.preventDefault();
    },
  });
}

export interface EditableImageProps {
  fieldKey: string;
  value: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Renders an `<img>`. In view mode it's a plain image. In edit mode it gains a
 * hover "Edit image" overlay; clicking selects the section so the side panel
 * surfaces this field's `<ImageUploadField>` (which owns the actual upload).
 */
export function EditableImage({
  fieldKey,
  value,
  alt = '',
  className,
  style,
}: EditableImageProps): ReactElement {
  const { editing, onSelect } = useSectionEdit();

  if (!editing) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return <img src={value} alt={alt} className={className} style={style} />;
  }

  // Edit mode keeps the same <img> element (so class-based CSS like
  // `.home__story img` still applies); clicking selects the section so the
  // side panel surfaces this field's <ImageUploadField>.
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={value}
      alt={alt}
      className={cn('pb-editable-image', className)}
      style={style}
      title="Click to edit image (panel)"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(fieldKey);
      }}
    />
  );
}
