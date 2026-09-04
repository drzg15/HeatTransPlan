import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { getExample } from '../api/io';
import { useTranslation, Trans } from 'react-i18next';
import styles from './HomePage.module.css';

const PROJECT_IMG_URL =
  'https://www.heattransplan.de/fileadmin/_processed_/4/c/csm_AdobeStock_880898724_d3e9ed3e63.jpeg';

function qrImgUrl(url: string, size = 110) {
  const encoded = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&margin=4`;
}

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setState = useProjectStore((s) => s.setState);
  const [loadingExample, setLoadingExample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadExample = async (filename: string) => {
    setLoadingExample(true);
    setError(null);
    try {
      const data = await getExample(filename);
      // data is the full project state JSON
      setState(data);
      setSuccessMsg(t('home.example_success'));
      setTimeout(() => navigate('/data-collection'), 800);
    } catch (e: any) {
      setError(e.message || t('home.example_error'));
    } finally {
      setLoadingExample(false);
    }
  };

  return (
    <div className={styles['home-page']}>
      <div className={styles['home-grid']}>
        {/* Left column */}
        <div className={styles['home-left']}>
          <h1>{t('home.title')}</h1>

          <h2>{t('home.information')}</h2>

          <div className={styles['home-info-row']}>
            <a href="https://www.heattransplan.de/" target="_blank" rel="noopener noreferrer">
              <img
                src={PROJECT_IMG_URL}
                alt="HeatTransPlan project"
                className={styles['home-project-img']}
                width={400}
              />
            </a>

            <div className={styles['home-qr-col']}>
              <div className={styles['qr-item']}>
                <a href="https://www.heattransplan.de/" target="_blank" rel="noopener noreferrer">
                  <img
                    src={qrImgUrl('https://www.heattransplan.de/')}
                    alt="Project website QR"
                    width={110}
                  />
                </a>
                <span className={styles['qr-label']}>{t('home.project_website')}</span>
              </div>
              <div className={styles['qr-item']}>
                <a
                  href="https://heattransplan.uni-paderborn.de/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={qrImgUrl('https://heattransplan.uni-paderborn.de/')}
                    alt="App QR"
                    width={110}
                  />
                </a>
                <span className={styles['qr-label']}>{t('home.app')}</span>
              </div>
            </div>
          </div>

          <p
            className={styles['home-about-link']}
            dangerouslySetInnerHTML={{ __html: t('home.about_link') }}
          ></p>

          <h2>{t('home.about_title')}</h2>
          <p dangerouslySetInnerHTML={{ __html: t('home.about_text') }}></p>

          <h3>{t('home.how_to_use')}</h3>
          <ul className={styles['home-instructions']}>
            <li>
              <Trans i18nKey="home.instruction_1">
                Open <strong>Energy Data Collection</strong> to locate the facility, describe the
                process and add energy data.
              </Trans>
            </li>
            <li>{t('home.instruction_2')}</li>
            <li>{t('home.instruction_3')}</li>
          </ul>

          <h3>{t('home.examples')}</h3>
          {error && <div className={styles['home-error']}>{error}</div>}
          {successMsg && <div className={styles['home-success']}>{successMsg}</div>}

          <button
            className="btn btn-primary"
            onClick={() => loadExample('heat_integration_example_1.json')}
            disabled={loadingExample}
          >
            {loadingExample ? <span className="spinner" /> : t('home.load_example_1')}
          </button>
        </div>

        {/* Right column - empty for now, matching original layout ratio */}
        <div className={styles['home-right']} />
      </div>
    </div>
  );
}
