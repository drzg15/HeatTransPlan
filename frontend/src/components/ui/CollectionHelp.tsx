import React from 'react';
import { useTranslation } from 'react-i18next';
import './AnalysisHelp.css'; // Reusing the same styling

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CollectionHelp: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="analysis-help-panel">
      <div className="help-header">
        <h3>🔍 {t('collection_help.title')}</h3>
        <button className="help-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="help-scroll">
        <section className="help-section">
          <h4>🗺️ {t('collection_help.map_ui')}</h4>
          <p dangerouslySetInnerHTML={{ __html: t('collection_help.map_ui_desc') }} />
        </section>

        <section className="help-section">
          <h4>🏭 {t('collection_help.add_process')}</h4>
          <p dangerouslySetInnerHTML={{ __html: t('collection_help.add_process_desc') }} />
        </section>

        <section className="help-section">
          <h4>⚙️ {t('collection_help.subprocesses')}</h4>
          <p dangerouslySetInnerHTML={{ __html: t('collection_help.subprocesses_desc') }} />
        </section>

        <section className="help-section">
          <h4>🔗 {t('collection_help.connections')}</h4>
          <p dangerouslySetInnerHTML={{ __html: t('collection_help.connections_desc') }} />
        </section>

        <div className="help-footer">
          <p>
            ✨ <em dangerouslySetInnerHTML={{ __html: t('collection_help.tip') }} />
          </p>
        </div>
      </div>
    </div>
  );
};

export default CollectionHelp;
