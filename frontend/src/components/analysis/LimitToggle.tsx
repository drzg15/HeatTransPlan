interface Props {
  isDark: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  count: number;
  description: string;
}

/** A checkbox in the filter column that brings a class of result rows back, with its count. */
export default function LimitToggle({
  isDark,
  checked,
  onChange,
  label,
  count,
  description,
}: Props) {
  return (
    <label
      style={{
        marginTop: '0.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.4rem',
        fontSize: '0.8rem',
        color: isDark ? '#94A3B8' : '#64748B',
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: '0.15rem' }}
      />
      <span>
        {label} ({count})
        <br />
        <span style={{ fontSize: '0.75rem' }}>{description}</span>
      </span>
    </label>
  );
}
