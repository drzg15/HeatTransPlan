/** How to give an AI agent access: add this app's MCP address to the agent,
 *  then connect the page. Nothing to install: the backend serves MCP at /mcp. */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Copy, X } from 'lucide-react';
import { useFeatures } from '../hooks/useFeatures';
import '../components/analysis/CopFormulaModal.css';

/** A text to copy; wrap: a sentence (not a command), broken into lines. */
function Command({ text, wrap = false }: { text: string; wrap?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={`live-setup-cmd${wrap ? ' live-setup-cmd-wrap' : ''}`}>
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
  // Agents that run in the cloud (web chats, connectors) need a public https
  // address; an app served over http is reachable from this computer only.
  const online = window.location.protocol === 'https:';

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
              {!online && <div className="cf-muted">{t('live.setup_local')}</div>}
              <div className="cf-muted">{t('live.setup_self')}</div>
              <Command text={t('live.setup_self_text', { url })} wrap />
              <div className="cf-muted">{t('live.setup_permissions')}</div>
              {features.api_key && <div className="cf-muted">{t('live.setup_key')}</div>}
              {/* Well-known agents as examples; the steps above work for any. */}
              <details className="live-setup-examples">
                <summary>{t('live.setup_examples')}</summary>
                <div className="cf-muted">{t('live.setup_ex_where')}</div>
                <ul className="live-setup-ex">
                  <li>{t('live.setup_ex_claude')}</li>
                  <li>{t('live.setup_ex_chatgpt')}</li>
                  <li>{t('live.setup_ex_mistral')}</li>
                  <li>
                    {t('live.setup_ex_claude_code')}
                    <Command text={`claude mcp add --transport http heattransplan ${url}`} />
                  </li>
                  <li>
                    {t('live.setup_ex_gemini')}
                    <Command text={`gemini mcp add --transport http heattransplan ${url}`} />
                    <Command
                      text={JSON.stringify(
                        { mcpServers: { heattransplan: { httpUrl: url } } },
                        null,
                        2
                      )}
                    />
                  </li>
                </ul>
                <div className="cf-muted">{t('live.setup_ex_note')}</div>
              </details>
            </li>
            <li>{t('live.setup_connect')}</li>
          </ol>
          <p>{t('live.setup_guided')}</p>
          <p className="cf-muted">{t('live.setup_files')}</p>
          <p>
            <a
              href="/docs/api_and_mcp.html#the-mcp-server"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('live.setup_docs')} ↗
            </a>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
