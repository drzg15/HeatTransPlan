import React from 'react';
import { useTranslation } from 'react-i18next';
import './AnalysisHelp.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const AnalysisHelp: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="analysis-help-panel">
      <div className="help-header">
        <h3>🔍 {t('help.title')}</h3>
        <button className="help-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="help-scroll">
        <section className="help-section">
          <h4>🖱️ {t('help.smart_selection')}</h4>
          <p>{t('help.smart_selection_desc')}</p>
        </section>

        <section className="help-section">
          <h4>📂 {t('help.scenarios')}</h4>
          <p>{t('help.scenarios_desc')}</p>
        </section>

        <section className="help-section">
          <h4>📉 {t('help.composite_curves')}</h4>
          <p>{t('help.composite_curves_desc')}</p>
        </section>

        <section className="help-section">
          <h4>⛰️ {t('help.grand_composite_curve')}</h4>
          <p>{t('help.grand_composite_curve_desc')}</p>
        </section>

        <section className="help-section">
          <h4>⚡ {t('help.hpi')}</h4>
          <p>{t('help.hpi_desc')}</p>
        </section>

        <section className="help-section">
          <h4>📈 {t('help.metrics')}</h4>
          <p>{t('help.metrics_desc')}</p>
        </section>

        <div className="help-footer">
          <p>
            ✨ <em>{t('help.tip')}</em>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisHelp;

