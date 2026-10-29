/** The home page: the app's own structure (1 Data Collection, 2–4 the parts
 *  of Potential Analysis, the results), each card opening the guided tour at
 *  its place, and the ways to start. The titles and inputs are the banners'
 *  own labels (PARTS in tour/guidedTour.ts). */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Bot, CirclePlay, FileText, FolderOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getExample } from '../api/io';
import { useProjectStore } from '../store/projectStore';
import { loadProject } from '../store/loadProject';
import { useFeatures } from '../hooks/useFeatures';
import LiveSetup from '../live/LiveSetup';
import { CHAPTERS, PARTS, startTour, type PartNumber } from '../tour/guidedTour';
import styles from './HomePage.module.css';

const EXAMPLE = 'heat_integration_example_1.json';
const PROJECT_URL = 'https://www.heattransplan.de/';
const PROJECT_IMG_URL =
  'https://www.heattransplan.de/fileadmin/_processed_/4/c/csm_AdobeStock_880898724_d3e9ed3e63.jpeg';

/** A QR code image for a link (the service the current home page uses). */
const qr = (url: string, size = 150) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&margin=4`;

interface Card {
  key: string;
  chapter: number;
  /** One of the app's numbered steps: number, title and input as its banner shows them. */
  part?: PartNumber;
  icon?: LucideIcon;
  /** Bullets for "more about it", folded away: home_preview.<key>_more_<n>. */
  more?: number;
}

/** The app's structure: its pages, and the three parts of Potential Analysis. */
const GROUPS: Array<{ label: string; cards: Card[] }> = [
  {
    label: 'appshell.nav.data_collection',
    cards: [{ key: 'collect', chapter: CHAPTERS.collect, part: 1 }],
  },
  {
    label: 'appshell.nav.potential_analysis',
    cards: [
      { key: 'integration', chapter: CHAPTERS.integration, part: 2, more: 4 },
      { key: 'heat_pump', chapter: CHAPTERS.heat_pump, part: 3 },
      { key: 'costs', chapter: CHAPTERS.costs, part: 4 },
    ],
  },
  {
    label: 'home_preview.results_group',
    cards: [{ key: 'results', chapter: CHAPTERS.results, icon: FileText }],
  },
];

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const features = useFeatures();
  const [setupOpen, setSetupOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExample = async () => {
    setBusy(true);
    setError(null);
    try {
      loadProject(await getExample(EXAMPLE));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const hasOwnData = () => (useProjectStore.getState().state.processes?.length ?? 0) > 0;

  // The tour shows the example, but never replaces someone's own project
  // without asking; declining tours their own project instead.
  const tour = async (from: number) => {
    if (!hasOwnData() || window.confirm(t('home_preview.tour_replace'))) {
      if (!(await loadExample())) return;
    }
    startTour(navigate, t, from);
  };

  const tryExample = async () => {
    if (hasOwnData() && !window.confirm(t('home_preview.example_replace'))) return;
    if (await loadExample()) navigate('/data-collection');
  };

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <h1 className="notranslate">HeatTransPlan</h1>
        <p className={styles.lead}>{t('home_preview.lead')}</p>
        <div className={styles.heroActions}>
          <button className="btn btn-primary" onClick={() => void tour(0)} disabled={busy}>
            <CirclePlay size={16} /> {t('home_preview.start_tour')}
          </button>
          <button className="btn" onClick={() => void tryExample()} disabled={busy}>
            <FolderOpen size={16} /> {t('home_preview.try_example')}
          </button>
        </div>
        <p className={styles.heroHint}>{t('home_preview.tour_hint')}</p>
        {error && <p className={styles.error}>{error}</p>}
      </header>

      <section aria-labelledby="hp-how">
        <h2 id="hp-how">{t('home_preview.how_title')}</h2>
        <div className={styles.flow}>
          {GROUPS.map((group, gi) => (
            <div key={group.label} className={styles.groupWrap}>
              {gi > 0 && (
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
              )}
              <div className={styles.group}>
                <span className={styles.groupLabel}>{t(group.label)}</span>
                <ol className={styles.cards}>
                  {group.cards.map(({ key, chapter, part, icon: Icon, more }) => (
                    <li key={key} className={styles.step}>
                      <div className={styles.stepHead}>
                        {part ? (
                          <span className={styles.num}>{part}</span>
                        ) : (
                          Icon && <Icon size={20} aria-hidden="true" />
                        )}
                      </div>
                      {/* A step keeps its banner's own title and input. */}
                      <h3>{part ? t(PARTS[part].title) : t(`home_preview.${key}_title`)}</h3>
                      {part && <p className={styles.input}>{t(PARTS[part].input)}</p>}
                      <p>{t(`home_preview.${key}_text`)}</p>
                      <p className={styles.need}>
                        <strong>{t(`home_preview.${key}_need_label`)}</strong>{' '}
                        {t(`home_preview.${key}_need`)}
                      </p>
                      {more && (
                        <details className={styles.details}>
                          <summary>{t(`home_preview.${key}_more_title`)}</summary>
                          <ul>
                            {Array.from({ length: more }, (_, n) => (
                              <li key={n}>{t(`home_preview.${key}_more_${n + 1}`)}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      <button
                        className={styles.showMe}
                        onClick={() => void tour(chapter)}
                        disabled={busy}
                      >
                        {t('home_preview.show_me')} ▶
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="hp-more">
        <h2 id="hp-more">{t('home_preview.more_title')}</h2>
        <div className={styles.more}>
          {features.ai && (
            <button className={styles.moreCard} onClick={() => setSetupOpen(true)}>
              <Bot size={20} aria-hidden="true" />
              <span>
                <strong>{t('home_preview.ai_title')}</strong>
                <span>{t('home_preview.ai_text')}</span>
              </span>
            </button>
          )}
          <a className={styles.moreCard} href="/docs/" target="_blank" rel="noopener noreferrer">
            <BookOpen size={20} aria-hidden="true" />
            <span>
              <strong>{t('home_preview.docs_title')}</strong>
              <span>{t('home_preview.docs_text')}</span>
            </span>
          </a>
        </div>
      </section>

      <section aria-labelledby="hp-good" className={styles.good}>
        <h2 id="hp-good">{t('home_preview.good_title')}</h2>
        <ul>
          <li>{t('home_preview.good_screening')}</li>
          <li>{t('home_preview.good_data')}</li>
        </ul>
      </section>

      <section aria-labelledby="hp-about" className={styles.about}>
        <h2 id="hp-about">{t('home_preview.project_title')}</h2>
        <div className={styles.aboutRow}>
          <a
            href={PROJECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.aboutImg}
          >
            <img src={PROJECT_IMG_URL} alt={t('home_preview.project_img_alt')} />
          </a>
          <div className={styles.aboutText}>
            <p>{t('home_preview.project_text')}</p>
            <a href={PROJECT_URL} target="_blank" rel="noopener noreferrer">
              {t('home_preview.project_link')} ↗
            </a>
          </div>
          <div className={styles.qrs}>
            {[
              { url: PROJECT_URL, label: t('home.project_website') },
              // This app's own address: right on a laptop and on the server alike.
              { url: `${window.location.origin}/`, label: t('home.app') },
            ].map(({ url, label }) => (
              <figure key={label}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={qr(url)}
                    alt={t('home_preview.qr_alt', { name: label })}
                    width={130}
                    height={130}
                  />
                </a>
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {setupOpen && <LiveSetup onClose={() => setSetupOpen(false)} />}
    </div>
  );
}
