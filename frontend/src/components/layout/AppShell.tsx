import { type ReactNode, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import LanguagePicker from './LanguagePicker';
import './AppShell.css';

interface Props {
  children: ReactNode;
}

const NAV_ITEMS = [
  {
    path: '/',
    translationKey: 'appshell.nav.home',
    icon: (
      <img
        src="/favicon.svg"
        alt="HTP"
        style={{ width: '1.2em', height: '1.2em', display: 'block' }}
      />
    ),
  },
  { path: '/data-collection', translationKey: 'appshell.nav.data_collection', icon: '📊' },
  { path: '/potential-analysis', translationKey: 'appshell.nav.potential_analysis', icon: '📈' },
];

export default function AppShell({ children }: Props) {
  const { t } = useTranslation();
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  // Burger menu — only rendered/visible below 768px, see AppShell.css
  const [menuOpen, setMenuOpen] = useState(false);

  const state = useProjectStore((s) => s.state);
  const resetState = useProjectStore((s) => s.resetState);
  const [showResetModal, setShowResetModal] = useState(false);

  const handleSave = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heattransplan_state_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sync dark mode class to HTML element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Escape closes the menu, matching the rest of the app's overlays.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="app-shell">
      {/* Top Navigation */}
      <header className="top-nav">
        <div className="nav-brand">
          <span className="brand-text notranslate">HeatTransPlan</span>
          <span className="brand-version notranslate">v2.3.0</span>
        </div>

        <nav id="app-nav" className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end={item.path === '/'}
              title={t(item.translationKey)}
              // Closing here rather than in an effect on the route: the tap is
              // the actual cause, and it keeps setState out of an effect body.
              onClick={() => setMenuOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{t(item.translationKey)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="nav-actions">
          <a
            href="https://davidzapata.github.io/HeatTransPlan/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm"
            style={{ marginRight: '8px', textDecoration: 'none' }}
            title="Open Documentation"
          >
            📖 Documentation
          </a>
          <button
            className="btn btn-sm"
            onClick={() => setShowResetModal(true)}
            title="Clear all data and reset project"
            style={{ marginRight: '8px' }}
          >
            🔄 Reset all data
          </button>
          <LanguagePicker />
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? t('appshell.theme.light') : t('appshell.theme.dark')}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            className="theme-toggle nav-burger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="app-nav"
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
              {menuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="main-content">{children}</main>

      {showResetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: 400,
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3 style={{ margin: 0, color: '#d32f2f' }}>{t('action_bar.reset_modal_title')}</h3>
            <p style={{ margin: 0, lineHeight: 1.5 }}>
              {t('action_bar.reset_modal_desc')}
            </p>
            <p style={{ margin: 0, fontSize: '0.9em', color: 'var(--text-muted)' }}>
              {t('action_bar.reset_modal_recommend')}
            </p>

            <div
              style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'flex-end' }}
            >
              <button className="btn" onClick={() => setShowResetModal(false)}>
                {t('cop_modal.cancel') || 'Cancel'}
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                💾 {t('action_bar.download_project')}
              </button>
              <button
                className="btn"
                style={{ background: '#d32f2f', color: '#fff', border: 'none' }}
                onClick={() => {
                  resetState();
                  setShowResetModal(false);
                }}
              >
                {t('action_bar.clear_anyway')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
