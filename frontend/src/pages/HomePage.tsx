import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../store/projectStore';
import { getExample } from '../api/io';
import { useTranslation, Trans } from 'react-i18next';
import styles from './HomePage.module.css';
import TutorialSidebar from '../components/ui/TutorialSidebar';

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
  const [showTutorial, setShowTutorial] = useState(false);

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

          <p
            className={styles['home-about-link']}
            dangerouslySetInnerHTML={{ __html: t('home.about_link') }}
          ></p>
          <p dangerouslySetInnerHTML={{ __html: t('home.about_text') }}></p>

          <div className={styles['home-info-row']} style={{ marginTop: '16px' }}>
            <a href="https://www.heattransplan.de/" target="_blank" rel="noopener noreferrer">
              <img
                src={PROJECT_IMG_URL}
                alt="HeatTransPlan project"
                className={styles['home-project-img']}
              />
            </a>

            <div className={styles['home-qr-col']} style={{ marginTop: '24px' }}>
              <div className={styles['qr-item']}>
                <a href="https://www.heattransplan.de/" target="_blank" rel="noopener noreferrer">
                  <img
                    src={qrImgUrl('https://www.heattransplan.de/', 180)}
                    alt="Project website QR"
                    width={180}
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
                    src={qrImgUrl('https://heattransplan.uni-paderborn.de/', 180)}
                    alt="App QR"
                    width={180}
                  />
                </a>
                <span className={styles['qr-label']}>{t('home.app')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className={styles['home-right']}>
          {!showTutorial ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              <h2>Get Started</h2>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 45%' }}>
                  <button
                    className="btn"
                    onClick={() => setShowTutorial(true)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', padding: '40px 24px', border: 'none', background: 'var(--brand-magenta)', color: '#fff', borderRadius: 'var(--radius-lg)', height: '100%', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>Tutorial (Quick guide)</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 400, opacity: 0.9, lineHeight: 1.4 }}>A fast, visual walk-through of the interface and the core features right here on this page.</span>
                  </button>
                </div>
                <div style={{ flex: '1 1 45%' }}>
                  <a
                    href="https://drzg15.github.io/HeatTransPlan/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center', padding: '40px 24px', border: 'none', background: '#475569', color: '#fff', borderRadius: 'var(--radius-lg)', textDecoration: 'none', height: '100%', boxShadow: 'var(--shadow-sm)' }}
                  >
                    <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>Technical Documentation</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 400, opacity: 0.9, lineHeight: 1.4, color: '#f8fafc' }}>Read the complete manual to understand all calculations, physics models, and engineering concepts used in the tool.</span>
                  </a>
                </div>
              </div>
              
              <div style={{ marginTop: '8px' }}>
                {error && <div className={styles['home-error']} style={{ marginBottom: '8px' }}>{error}</div>}
                {successMsg && <div className={styles['home-success']} style={{ marginBottom: '8px' }}>{successMsg}</div>}
                <button
                  className="btn"
                  onClick={() => loadExample('heat_integration_example_1.json')}
                  disabled={loadingExample}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', width: '100%', padding: '40px 24px', background: '#10b981', border: 'none', color: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)' }}
                >
                  <span style={{ fontSize: '1.3rem', fontWeight: 700 }}>{loadingExample ? t('home.loading') : 'Load Example 1: Heat integration example'}</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 400, opacity: 0.9, lineHeight: 1.4 }}>Instantly load a pre-configured industrial plant model to see the pinch analysis and heat pump optimization in action.</span>
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
              <button 
                className="btn" 
                onClick={() => setShowTutorial(false)}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
              >
                ← Go back
              </button>
              <TutorialSidebar
                onLoadExample={() => loadExample('heat_integration_example_1.json')}
                loadingExample={loadingExample}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
