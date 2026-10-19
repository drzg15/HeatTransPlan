import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore';
import HeatPumpTable from '../../components/analysis/HeatPumpTable';
import HPIChart from '../../components/analysis/HPIChart';

interface Props {
  availableHPNames: string[];
}

/** The classic HPI view: the heat pump table next to the HPI chart, with the pump multi-select. */
export default function ClassicHPISection({ availableHPNames }: Props) {
  const { t } = useTranslation();
  const selectedHPTypes = useAnalysisStore((s) => s.selectedHPTypes);
  const setSelectedHPTypes = useAnalysisStore((s) => s.setSelectedHPTypes);

  return (
    <div className="pa-hpi-layout">
      <div className="pa-hpi-table-col">
        <HeatPumpTable />
      </div>
      <div className="pa-hpi-chart-col">
        {availableHPNames.length > 0 && (
          <div className="pa-hp-select">
            <label>{t('analysis.charts.select_hp')}</label>
            <div className="pa-multi-select">
              {availableHPNames.map((name) => (
                <label key={name} className="pa-multi-option">
                  <input
                    type="checkbox"
                    checked={selectedHPTypes.includes(name)}
                    onChange={() => {
                      setSelectedHPTypes(
                        selectedHPTypes.includes(name)
                          ? selectedHPTypes.filter((n) => n !== name)
                          : [...selectedHPTypes, name]
                      );
                    }}
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>
        )}
        <HPIChart />
      </div>
    </div>
  );
}
