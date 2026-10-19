import type { RefObject } from 'react';
import { filterLabelStyle, filterSelectStyle } from './hpFilterStyles';

interface Props {
  label: string;
  /** Text shown while nothing is picked, i.e. the "All" label. */
  allLabel: string;
  isDark: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  onToggleOpen: () => void;
  options: string[];
  selected: string[]; // Empty means 'All'
  onToggleOption: (option: string) => void;
}

/** A multi-select dropdown of checkboxes, used by the refrigerant and HP stage filters. */
export default function FilterDropdown({
  label,
  allLabel,
  isDark,
  containerRef,
  open,
  onToggleOpen,
  options,
  selected,
  onToggleOption,
}: Props) {
  const labelStyle = filterLabelStyle(isDark);
  const selectStyle = filterSelectStyle(isDark);
  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      <div
        style={{
          ...selectStyle,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
        }}
        onClick={() => onToggleOpen()}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected.length === 0 ? allLabel : selected.join(', ')}
        </span>
        <span style={{ fontSize: '0.8em', marginLeft: '8px' }}>▼</span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: isDark ? '#1E293B' : '#FFF',
            border: `1px solid ${isDark ? '#475569' : '#CBD5E1'}`,
            borderRadius: '4px',
            zIndex: 10,
            width: '100%',
            padding: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          {options.map((ref) => (
            <label
              key={ref}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem 0',
                cursor: 'pointer',
                color: isDark ? '#F8FAFC' : '#0F172A',
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(ref)}
                onChange={() => onToggleOption(ref)}
              />
              {ref}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
