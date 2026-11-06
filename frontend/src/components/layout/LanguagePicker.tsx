/** LanguagePicker — globe button in the header showing the language (EN/DE);
 *  a click switches to the other one. Both have hand-written translations
 *  (src/locales), switched through i18next. */
import { useTranslation } from 'react-i18next';
import './LanguagePicker.css';

const NAMES: Record<string, string> = { en: 'English', de: 'Deutsch' };

export default function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const active = i18n.language?.startsWith('de') ? 'de' : 'en';
  const next = active === 'en' ? 'de' : 'en';

  const toggle = () => {
    i18n.changeLanguage(next);
    localStorage.setItem('i18nextLng', next);
  };

  return (
    <button
      className="theme-toggle lang-trigger notranslate"
      onClick={toggle}
      data-tip={`${t('ui.language')}: ${NAMES[active]}`}
      aria-label={t('ui.switch_language', { lang: NAMES[next] })}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
      </svg>
      <span className="lang-code">{active.toUpperCase()}</span>
    </button>
  );
}
