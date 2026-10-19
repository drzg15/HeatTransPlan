// Styles shared by the filter column of the heat pump optimisation panel.
export const filterSelectStyle = (isDark: boolean) => ({
  padding: '0.4rem',
  borderRadius: '4px',
  border: `1px solid ${isDark ? '#475569' : '#CBD5E1'}`,
  background: isDark ? '#1E293B' : '#FFF',
  color: isDark ? '#F8FAFC' : '#0F172A',
  minWidth: '150px',
});

export const filterLabelStyle = (isDark: boolean) => ({
  fontSize: '0.85rem',
  color: isDark ? '#94A3B8' : '#64748B',
  display: 'block' as const,
  marginBottom: '0.25rem',
  fontWeight: 500,
});
