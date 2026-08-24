/**
 * Shared inline styles for the local admin panels.
 *
 * These stay inline rather than moving to the `cpos-` classes because ten
 * panels consume them and the values are the only thing that had to change: by
 * routing every colour and radius through the register's tokens, all ten
 * follow the theme and go dark with the rest of the till without any of them
 * being edited. New panels should reach for the `cpos-section` / `cpos-field`
 * classes instead -- this module is kept for what already exists.
 */

export const section: React.CSSProperties = {
  border: '1px solid var(--cpos-border, #e6e9ee)',
  borderRadius: 'var(--cpos-r-lg, 16px)',
  background: 'var(--cpos-surface, #fff)',
  boxShadow: 'var(--cpos-sh-xs, 0 1px 2px rgba(15,23,42,0.06))',
  padding: 18,
  marginBottom: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

export const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };

export const fieldLabel: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 650,
  color: 'var(--cpos-fg, #0f172a)',
};

export const row: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-end',
  flexWrap: 'wrap',
};

export const muted: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--cpos-fg-muted, #64748b)',
};

export const warning: React.CSSProperties = { fontSize: 13, color: 'var(--cpos-warning, #b45309)' };

export const danger: React.CSSProperties = { fontSize: 13, color: 'var(--cpos-danger, #dc2626)' };

export const actions: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
};
