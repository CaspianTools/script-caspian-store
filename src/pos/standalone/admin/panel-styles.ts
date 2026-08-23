/** Shared inline styles for the local admin panels, matching `/pos/settings`. */

export const section: React.CSSProperties = {
  border: '1px solid var(--caspian-border, #e5e5e5)',
  borderRadius: 'var(--caspian-radius, 12px)',
  padding: 16,
  marginBottom: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
};

export const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };

export const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600 };

export const row: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'flex-end',
  flexWrap: 'wrap',
};

export const muted: React.CSSProperties = { fontSize: 12, color: '#666' };

export const warning: React.CSSProperties = { fontSize: 13, color: '#b45309' };

export const danger: React.CSSProperties = { fontSize: 13, color: 'var(--caspian-danger, #b3261e)' };

export const actions: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
};
