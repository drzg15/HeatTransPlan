/** How to give an AI agent access: add this app's MCP address to the agent,
 *  then connect the page. Nothing to install: the backend serves MCP at /mcp. */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Copy, X } from 'lucide-react';
import { useFeatures } from '../hooks/useFeatures';
import '../components/analysis/CopFormulaModal.css';

function Command({ text }: { text: string }) {
  const { t } = useTranslation();
  return (
    <div className="live-setup-cmd">
      <pre className="notranslate">{text}</pre>
      <button
        type="button"
        className="live-icon"
        onClick={() => navigator.clipboard?.writeText(text)}
        title={t('live.copy_command')}
        aria-label={t('live.copy_command')}
      >
        <Copy size={13} />
      </button>
    </div>
  );
}

export default function LiveSetup({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const features = useFeatures();
  // Caddy (and Vite in development) route /mcp to the backend.
  const url = `${window.location.origin}/mcp`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Portal: the header's stacking context would put the dialog under the map controls.
  return createPortal(
    <div className="cf-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cf-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('live.setup_title')}
      >
        <header className="cf-header">
          <h3>{t('live.setup_title')}</h3>
          <button className="cf-close" onClick={onClose} aria-label={t('live.close')}>
            <X size={16} />
          </button>
        </header>
        <div className="cf-body live-setup">
          <p>{t('live.setup_intro')}</p>
          <ol>
            <li>
              {t('live.setup_add')}
              <Command text={url} />
              <div className="cf-muted">{t('live.setup_where')}</div>
              {features.api_key && <div className="cf-muted">{t('live.setup_key')}</div>}
            </li>
            <li>{t('live.setup_connect')}</li>
          </ol>
          <p>{t('live.setup_guided')}</p>
          <p className="cf-muted">{t('live.setup_files')}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
