'use client';

import { useCaspianLink } from '../../provider/caspian-store-provider';
import { EditableText } from '../editor/editable';
import { cn } from '../../utils/cn';
import type { BlockComponentProps, BlockType } from '../types';

/**
 * Button widget — a single call-to-action. Reuses the storefront's `.btn`
 * classes so it matches native buttons. The label is inline-editable on the
 * canvas; in edit mode it renders as a non-navigating span so clicks edit
 * rather than follow the link.
 */
function ButtonWidget({ props, editing }: BlockComponentProps) {
  const Link = useCaspianLink();
  const variant = String(props.btnVariant ?? 'primary');
  const align = String(props.align ?? 'left');
  const label = String(props.label ?? '');
  const href = String(props.href ?? '');
  const className = cn('btn', `btn--${variant}`);

  return (
    <div className="pb-w-button-wrap" style={{ textAlign: align as 'left' | 'center' | 'right' }}>
      {editing ? (
        <span className={className}>
          <EditableText fieldKey="label" value={label} />
        </span>
      ) : (
        <Link href={href || '/'} className={className}>
          {label}
        </Link>
      )}
    </div>
  );
}

export const BUTTON_WIDGET: BlockType = {
  type: 'widget:button',
  category: 'widget',
  nameKey: 'pageBuilder.widget.button.name',
  descriptionKey: 'pageBuilder.widget.button.desc',
  fields: [
    { key: 'label', labelKey: 'pageBuilder.field.buttonLabel', type: 'text', inline: true },
    { key: 'href', labelKey: 'pageBuilder.field.linkHref', type: 'link' },
    {
      key: 'btnVariant',
      labelKey: 'pageBuilder.field.buttonStyle',
      type: 'select',
      options: [
        { value: 'primary', labelKey: 'pageBuilder.buttonStyle.primary' },
        { value: 'ghost', labelKey: 'pageBuilder.buttonStyle.ghost' },
      ],
    },
    {
      key: 'align',
      labelKey: 'pageBuilder.field.align',
      type: 'select',
      options: [
        { value: 'left', labelKey: 'pageBuilder.align.left' },
        { value: 'center', labelKey: 'pageBuilder.align.center' },
        { value: 'right', labelKey: 'pageBuilder.align.right' },
      ],
    },
  ],
  defaultProps: {
    label: 'Shop now',
    href: '/shop',
    btnVariant: 'primary',
    align: 'left',
  },
  Component: ButtonWidget,
};
