/** What the user controls while an AI is connected: pause it, see what it
 *  changed, and allow or refuse what it wants to delete or replace (the
 *  MCP server asks with the command confirm_ai_action and waits). */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { History, Pause, Play } from 'lucide-react';
import { useLiveCommand } from './commands';
import { setAiPaused, useLiveStore } from './liveClient';
import '../components/analysis/CopFormulaModal.css';

// The MCP server waits 120 s for an answer; refuse a little before that.
const ASK_SECONDS = 110;

interface Ask {
  kind: string;
  name: string;
  answer: (allowed: boolean) => void;
}

export default function AiControls() {
  const { t } = useTranslation();
  const paused = useLiveStore((s) => s.paused);
  const log = useLiveStore((s) => s.log);
  const [showLog, setShowLog] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);

  useLiveCommand(
    'confirm_ai_action',
    (args) =>
      new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => done(false), ASK_SECONDS * 1000);
        const done = (allowed: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          setAsk(null);
          resolve({ allowed });
        };
        const name = String(args.name ?? '');
        // Replacing with a project given as data has no file name to show.
        const kind =
          args.kind === 'replace_project' && !name ? 'set_project' : String(args.kind ?? '');
        setAsk({ kind, name, answer: done });
      })
  );

  // An open question goes when the page disconnects.
  useEffect(() => () => ask?.answer(false), [ask]);

  return (
    <>
      <button
        type="button"
        className={`live-icon${paused ? ' live-icon-on' : ''}`}
        onClick={() => void setAiPaused(!paused).catch(() => {})}
        title={paused ? t('live.resume') : t('live.pause')}
        aria-label={paused ? t('live.resume') : t('live.pause')}
        aria-pressed={paused}
      >
        {paused ? <Play size={13} /> : <Pause size={13} />}
      </button>
      <span className="live-activity-wrap">
        <button
          type="button"
          className="live-icon"
          onClick={() => setShowLog((v) => !v)}
          title={t('live.activity')}
          aria-label={t('live.activity')}
          aria-expanded={showLog}
        >
          <History size={13} />
          {log.length > 0 && <span className="live-count">{log.length}</span>}
        </button>
        {showLog && (
          <div className="live-activity" role="dialog" aria-label={t('live.activity')}>
            <strong>{t('live.activity')}</strong>
            {log.length === 0 ? (
              <p className="cf-muted">{t('live.activity_empty')}</p>
            ) : (
              <ol>
                {[...log].reverse().map((e, i) => (
                  <li key={`${e.time}-${i}`}>
                    <time>
                      {new Date(e.time * 1000).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>{' '}
                    <code className="notranslate">{e.tool}</code> {e.detail}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </span>
      {paused && <span className="live-paused">{t('live.paused')}</span>}
      {ask &&
        createPortal(
          <div className="cf-backdrop" role="presentation">
            <div
              className="cf-modal live-confirm"
              role="alertdialog"
              aria-modal="true"
              aria-label={t('live.confirm_title')}
            >
              <header className="cf-header">
                <h3>{t('live.confirm_title')}</h3>
              </header>
              <div className="cf-body">
                <p>
                  {t(`live.confirm_${ask.kind}`, {
                    name: ask.name,
                    defaultValue: t('live.confirm_other', { name: `${ask.kind} ${ask.name}` }),
                  })}
                </p>
                <div className="live-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => ask.answer(false)}
                    autoFocus
                  >
                    {t('live.deny')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => ask.answer(true)}
                  >
                    {t('live.allow')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
