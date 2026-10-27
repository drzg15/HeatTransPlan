/** StreamSelector — checkbox list of all streams grouped by subprocess. */

import { useEffect, useCallback } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { getStreamInfo } from '../../utils/streamUtils';
import type { Stream } from '../../types/stream';
import ChartHelpButton from '../ui/ChartHelpButton';
import { useTranslation } from 'react-i18next';
import { shiftedRange, usePinchLink } from '../../store/pinchLinkStore';

export default function StreamSelector() {
  const { t } = useTranslation();
  const processes = useProjectStore((s) => s.state.processes);
  const selectedStreams = useAnalysisStore((s) => s.selectedStreams);
  const setSelectedStream = useAnalysisStore((s) => s.setSelectedStream);
  // Linked with the pinch charts: hovering a stream marks it on the curves,
  // hovering a temperature on the curves marks the streams running through it.
  const half = useAnalysisStore((s) => (s.pinchResult?.T_min ?? 0) / 2);
  const hoverT = usePinchLink((s) => s.hoverT);
  const setStream = usePinchLink((s) => s.setStream);

  // Initialize any streams that haven't been seen yet as "selected" by default
  useEffect(() => {
    const keysToEnable: string[] = [];
    processes.forEach((proc, pi) => {
      (proc.streams ?? []).forEach((_s: Stream, si: number) => {
        const key = `stream_${pi}_${si}`;
        // If it's not even in the map yet, we mark it as "to be enabled"
        if (selectedStreams[key] === undefined) {
          keysToEnable.push(key);
        }
      });
    });

    if (keysToEnable.length > 0) {
      // Direct merge into store to avoid overwriting existing selections
      const next = { ...selectedStreams };
      keysToEnable.forEach((k) => (next[k] = true));
      useAnalysisStore.setState({ selectedStreams: next });
    }
  }, [processes, selectedStreams]);

  const handleToggle = useCallback(
    (key: string) => {
      setSelectedStream(key, !selectedStreams[key]);
    },
    [selectedStreams, setSelectedStream]
  );

  if (!processes.length) {
    return <div className="pa-info-box">{t('analysis.messages.no_processes')}</div>;
  }

  return (
    <div className="pa-panel">
      <h4
        className="pa-panel-title"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {t('stream_selector.title')}
          <ChartHelpButton
            inline
            title={t('stream_selector.title')}
            description={t('stream_selector.help_desc')}
          />
        </span>
      </h4>

      <div className="pa-stream-list">
        {processes.map((proc, pi) => {
          const streams = proc.streams ?? [];
          if (streams.length === 0) return null;
          const procName = proc.name || `${t('stream_selector.subprocess')} ${pi + 1}`;
          return (
            <div key={pi} className="pa-stream-group">
              <div className="pa-stream-group-title">{procName}</div>
              {streams.map((stream: Stream, si: number) => {
                const key = `stream_${pi}_${si}`;
                const checked = selectedStreams[key] ?? true;
                const info = getStreamInfo(stream);
                const streamName = stream.name || `${t('stream_selector.stream')} ${si + 1}`;

                const parts: string[] = [];
                if (info.tin !== null) parts.push(`Tin:${info.tin}°C`);
                if (info.tout !== null) parts.push(`Tout:${info.tout}°C`);
                if (info.CP !== null) parts.push(`CP:${info.CP.toFixed(2)}`);
                if (info.Q !== null) parts.push(`Q:${info.Q.toFixed(2)} kW`);
                if (info.type) parts.push(info.type.includes('Hot') ? '🔴' : '🔵');

                const hot = info.tin !== null && info.tout !== null && info.tin > info.tout;
                const complete = checked && info.tin !== null && info.tout !== null;
                const range = complete
                  ? shiftedRange({ tin: info.tin!, tout: info.tout!, hot }, half)
                  : null;
                const active =
                  hoverT !== null && range !== null && hoverT >= range[0] && hoverT <= range[1];

                return (
                  <label
                    key={key}
                    className={`pa-stream-item ${hot ? 'pa-stream-hot' : 'pa-stream-cold'}${active ? (hot ? ' pa-stream-hot-active' : ' pa-stream-cold-active') : ''}`}
                    title={streamName}
                    onMouseEnter={() =>
                      complete &&
                      setStream({
                        name: streamName,
                        tin: info.tin!,
                        tout: info.tout!,
                        Q: info.Q ?? 0,
                        hot,
                      })
                    }
                    onMouseLeave={() => setStream(null)}
                  >
                    <input type="checkbox" checked={checked} onChange={() => handleToggle(key)} />
                    <span className="pa-stream-name">{streamName}</span>
                    <span className="pa-stream-info">
                      {parts.length > 0 ? parts.join(' | ') : t('stream_selector.incomplete')}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
