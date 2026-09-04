import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import './TutorialPanel.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TutorialPanel: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="tutorial-panel">
      <div className="tutorial-header">
        <h3>🚀 {t('tutorial.title')}</h3>
        <button className="tutorial-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="tutorial-scroll">
        <div className="tutorial-step">
          <div className="step-circle">1</div>
          <div className="step-content">
            <strong>{t('tutorial.step1_title')}</strong>
            <p>{t('tutorial.step1_desc')}</p>
          </div>
        </div>

        <div className="tutorial-step">
          <div className="step-circle">2</div>
          <div className="step-content">
            <strong>{t('tutorial.step2_title')}</strong>
            <p>
              <Trans i18nKey="tutorial.step2_desc">
                When you've framed your site, click <strong>🔓 Lock Map</strong>. This enables the
                placement and editing mode.
              </Trans>
            </p>
          </div>
        </div>

        <div className="tutorial-step">
          <div className="step-circle">3</div>
          <div className="step-content">
            <strong>{t('tutorial.step3_title')}</strong>
            <p>
              <Trans i18nKey="tutorial.step3_desc">
                Click <strong>⚙️ Add Process</strong> in the top menu to create a new process group
                for your site.
              </Trans>
            </p>
          </div>
        </div>

        <div className="tutorial-step">
          <div className="step-circle">4</div>
          <div className="step-content">
            <strong>{t('tutorial.step4_title')}</strong>
            <p>
              <Trans i18nKey="tutorial.step4_desc">
                Click the <strong>📍 icon</strong> next to a process name in the left panel, then
                click on the map to place its marker.
              </Trans>
            </p>
          </div>
        </div>

        <div className="tutorial-step">
          <div className="step-circle">5</div>
          <div className="step-content">
            <strong>{t('tutorial.step5_title')}</strong>
            <p>
              <Trans i18nKey="tutorial.step5_desc">
                Expand a process to add <strong>Hot/Cold Streams</strong>. Enter Temperatures (°C) and
                CP (kW/K) to track heat loads.
              </Trans>
            </p>
          </div>
        </div>

        <div className="tutorial-step">
          <div className="step-circle">6</div>
          <div className="step-content">
            <strong>{t('tutorial.step6_title')}</strong>
            <p>
              <Trans i18nKey="tutorial.step6_desc">
                Switch to the <strong>Potential Analysis</strong> page in the sidebar to see energy
                savings and pinch integration curves.
              </Trans>
            </p>
          </div>
        </div>

        <div className="tutorial-footer">
          <p>
            💡 <em>{t('tutorial.tip')}</em>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TutorialPanel;

