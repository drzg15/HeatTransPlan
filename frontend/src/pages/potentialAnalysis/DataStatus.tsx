import { getStreamInfo } from '../../utils/streamUtils';
import type { ProcessNode } from '../../types/process';

interface Props {
  selectedStreams: Record<string, boolean>;
  processes: ProcessNode[];
}

/** Which of the selected streams still lack data, shown when too few are usable for a pinch analysis. */
export default function DataStatus({ selectedStreams, processes }: Props) {
  return (
    <div className="pa-data-status">
      <strong>Data status for selected items:</strong>
      {Object.entries(selectedStreams)
        .filter(([, v]) => v)
        .map(([key]) => {
          if (!key.startsWith('stream_')) return null;
          const parts = key.split('_');
          const pIdx = parseInt(parts[1], 10);
          const sIdx = parseInt(parts[2], 10);
          if (pIdx >= processes.length) return null;
          const proc = processes[pIdx];
          const streams = proc.streams ?? [];
          if (sIdx >= streams.length) return null;
          const stream = streams[sIdx];
          const info = getStreamInfo(stream);
          const procName = proc.name || `Subprocess ${pIdx + 1}`;
          const streamName = stream.name || `Stream ${sIdx + 1}`;
          const missing: string[] = [];
          if (info.tin === null) missing.push('Tin');
          if (info.tout === null) missing.push('Tout');
          if (info.CP === null) {
            if (info.mdot === null) missing.push('ṁ');
            if (info.cp === null) missing.push('cp');
            missing.push('(or CP)');
          }
          return (
            <div key={key} className={missing.length > 0 ? 'pa-missing' : 'pa-complete'}>
              {missing.length > 0
                ? `⚠️ ${procName} - ${streamName}: Missing ${missing.join(', ')}`
                : `✅ ${procName} - ${streamName}: Complete data`}
            </div>
          );
        })}
    </div>
  );
}
