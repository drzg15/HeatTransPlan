import React from 'react';
import { useTranslation } from 'react-i18next';
import TutorialSidebar from './TutorialSidebar';
import './TutorialPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TutorialPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="tutorial-backdrop" onClick={onClose}>
      <div className="tutorial-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tutorial-header">
          <h3>🚀 {t('tutorial.title', 'HeatTransPlan Tutorial')}</h3>
          <button className="tutorial-close" onClick={onClose} aria-label="Close tutorial">
            ×
          </button>
        </div>

        <div className="tutorial-pdf-container" style={{ width: '100%', flex: 1, backgroundColor: 'var(--surface)', overflow: 'hidden', padding: '0 16px 16px 16px' }}>
          <TutorialSidebar />
        </div>
      </div>
    </div>
  );
};

export default TutorialPanel;
