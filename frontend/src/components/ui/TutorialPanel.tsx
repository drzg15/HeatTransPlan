import React from 'react';
import { useTranslation } from 'react-i18next';
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

        <div className="tutorial-pdf-container" style={{ width: '100%', height: '100%', flex: 1, backgroundColor: '#333' }}>
          <object
            data="/assets/tutorial/slideshow.pdf#toolbar=1&navpanes=0&scrollbar=0&view=FitH"
            type="application/pdf"
            width="100%"
            height="100%"
            style={{ display: 'block', minHeight: '600px' }}
          >
            <p>
              Your browser does not support PDFs. 
              <a href="/assets/tutorial/slideshow.pdf">Download the tutorial PDF</a>.
            </p>
          </object>
        </div>
      </div>
    </div>
  );
};

export default TutorialPanel;
