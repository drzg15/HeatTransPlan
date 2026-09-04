import { useTranslation } from 'react-i18next';
import type { Stream, StreamType } from '../../types/stream';
import './StreamEditor.css';

interface Props {
  id?: string;
  stream: Stream;
  onChange: (updated: Stream) => void;
  onDelete: () => void;
}

const ALL_VARS = [
  'Tin',
  'Tout',
  'ṁ',
  'cp',
  'CP',
  'Water Content In',
  'Water Content Out',
  'Density',
  'Pressure',
];

const DEFAULT_VARS: Record<StreamType, string[]> = {
  product: ['Tin', 'Tout', 'ṁ', 'cp'],
  steam: ['Tin', 'ṁ'],
  water: ['Tin', 'Tout', 'ṁ', 'cp'],
  air: ['Tin', 'ṁ', 'Water Content In', 'Water Content Out'],
};

const STREAM_TYPES: StreamType[] = ['product', 'steam', 'air', 'water'];

const UNIT_OPTIONS: Record<string, string[]> = {
  Tin: ['°C', '°F', 'K'],
  Tout: ['°C', '°F', 'K'],
  ṁ: ['kg/s', 'kg/min', 'kg/h', 't/min', 't/h', 't/d'],
  cp: ['kJ/(kg·K)', 'J/(kg·K)'],
  CP: ['kW/K', 'W/K'],
  Density: ['kg/m³', 'g/cm³'],
  'Water Content In': ['%', 'g/kg', 'kg/kg'],
  'Water Content Out': ['%', 'g/kg', 'kg/kg'],
  Pressure: ['bar', 'Pa', 'atm'],
};

export default function StreamEditor({ id, stream, onChange, onDelete }: Props) {
  const { t } = useTranslation();

  const displayVars = stream.display_vars?.length
    ? stream.display_vars
    : DEFAULT_VARS[stream.type] || DEFAULT_VARS.product;

  const update = (partial: Partial<Stream>) => {
    onChange({ ...stream, ...partial });
  };

  const handleTypeChange = (type: StreamType) => {
    update({
      type,
      display_vars: DEFAULT_VARS[type],
    });
  };

  const toggleVar = (varName: string) => {
    const current = [...displayVars];
    const idx = current.indexOf(varName);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(varName);
    }
    update({ display_vars: current });
  };

  const updateValue = (key: string, value: string) => {
    const sv = { ...(stream.stream_values || {}) };
    sv[key] = value;
    update({ stream_values: sv });
  };

  const updateUnit = (key: string, unit: string) => {
    const su = { ...(stream.stream_units || {}) };
    su[key] = unit;
    update({ stream_units: su });
  };

  const getStreamValue = (key: string): string => {
    if (stream.stream_values && stream.stream_values[key] !== undefined) {
      return stream.stream_values[key] as string;
    }
    // fallback 1: properties/values mapping
    if (stream.properties && stream.values) {
      const propEntry = Object.entries(stream.properties).find(([_, v]) => v === key);
      if (propEntry) {
        const valKey = propEntry[0].replace('prop', 'val');
        if ((stream.values as Record<string, string>)[valKey] !== undefined) {
          return (stream.values as Record<string, string>)[valKey];
        }
      }
    }
    // fallback 2: direct legacy fields
    const s = stream as any;
    if (key === 'Tin' && s.temp_in !== undefined) return String(s.temp_in);
    if (key === 'Tout' && s.temp_out !== undefined) return String(s.temp_out);
    if (key === 'ṁ' && s.mdot !== undefined) return String(s.mdot);
    if (key === 'cp' && s.cp !== undefined) return String(s.cp);

    return '';
  };

  return (
    <div className="se-card" id={id}>
      {/* Header row */}
      <div className="se-header">
        <input
          type="text"
          className="se-name"
          value={stream.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder={t('stream.name_placeholder')}
        />
        <select
          className="se-type"
          value={stream.type}
          onChange={(e) => handleTypeChange(e.target.value as StreamType)}
        >
          {STREAM_TYPES.map((typeKey) => (
            <option key={typeKey} value={typeKey}>
              {t(`stream.types.${typeKey}`)}
            </option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={onDelete} title={t('stream.delete_stream')}>
          ✕
        </button>
      </div>

      {/* Variable selector */}
      <div className="se-var-selector">
        {ALL_VARS.map((v) => {
          const isSelected = displayVars.includes(v);
          return (
            <button
              key={v}
              className={`se-var-pill ${isSelected ? 'active' : ''}`}
              onClick={() => toggleVar(v)}
            >
              {t(`stream.vars.${v}`, v)}
            </button>
          );
        })}
      </div>

      {/* Value inputs */}
      <div className="se-values">
        {displayVars.map((v) => {
          const hasUnits = UNIT_OPTIONS[v] !== undefined;
          const currentUnit = stream.stream_units?.[v] || (hasUnits ? UNIT_OPTIONS[v][0] : '');

          return (
            <div key={v} className="se-value-field">
              <div className="se-label-row">
                <label>{t(`stream.vars.${v}`, v)}</label>
                {hasUnits && (
                  <select
                    className="se-unit-select"
                    value={currentUnit}
                    onChange={(e) => updateUnit(v, e.target.value)}
                  >
                    {UNIT_OPTIONS[v].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <input
                type="text"
                value={getStreamValue(v)}
                onChange={(e) => updateValue(v, e.target.value)}
                placeholder="—"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
