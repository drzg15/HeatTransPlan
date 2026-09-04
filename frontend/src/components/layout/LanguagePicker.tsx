/** LanguagePicker — globe button in the header that opens a language menu.
 *
 *  English and German have hand-written translations (src/locales), so those
 *  are switched through i18next. Everything else is machine-translated by the
 *  hidden Google Translate widget that index.html mounts. The full language
 *  list is read off that widget's own <select>, so it is exactly what Google
 *  offers rather than a list here that would drift out of date.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguagePicker.css';

interface Language {
  code: string;
  /** Name in the language itself, e.g. "Français". */
  label: string;
  /** English name, so the search box also matches "French". */
  english?: string;
}



const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
];

export default function LanguagePicker() {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = i18n.language || 'en';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const choose = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('i18nextLng', code);
    setOpen(false);
  };

  const activeLabel =
    SUPPORTED_LANGUAGES.find((l) => l.code === active)?.label ?? 'English';

  return (
    <div className="lang-picker notranslate" ref={rootRef}>
      <button
        className="theme-toggle lang-trigger"
        onClick={() => setOpen((v) => !v)}
        title={`Language — ${activeLabel}`}
        aria-label="Choose language"
        aria-expanded={open}
        aria-haspopup="menu"
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
      </button>

      {open && (
        <div className="lang-menu notranslate" role="menu">
          <div className="lang-group">{t('appshell.lang_select')}</div>
          <div className="lang-list">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                role="menuitem"
                className={`lang-item ${active === l.code ? 'active' : ''}`}
                onClick={() => choose(l.code)}
              >
                <span>{l.label}</span>
                {active === l.code && <span className="lang-tick">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
