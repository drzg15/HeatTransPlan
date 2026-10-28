/** How to give an AI assistant access: install the MCP server once, add it to
 *  the assistant, then connect the page. Commands carry this app's address. */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Copy, X } from 'lucide-react';
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
  // The backend answers under the page's own address (Vite and Caddy proxy /api).
  const url = window.location.origin;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const config = JSON.stringify(
    {
      mcpServers: {
        heattransplan: { command: 'heattransplan-mcp', env: { HEATTRANSPLAN_URL: url } },
      },
    },
    null,
    2
  );

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
              {t('live.setup_install')}
              <Command text="uv tool install --editable ./mcp_server" />
            </li>
            <li>
              {t('live.setup_add')}
              <div className="cf-muted">{t('live.setup_command')}</div>
              <Command text="heattransplan-mcp" />
              <div className="cf-muted">{t('live.setup_env')}</div>
              <Command text={`HEATTRANSPLAN_URL=${url}`} />
              <div className="cf-muted">{t('live.setup_json')}</div>
              <Command text={config} />
              <div className="cf-muted">{t('live.setup_key')}</div>
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
