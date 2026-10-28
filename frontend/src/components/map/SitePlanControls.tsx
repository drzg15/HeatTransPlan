/** Loading, placing and removing the user's own site plan. */

import { useRef, useState } from 'react';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import { ImagePlus, LoaderCircle, Scan, Trash2 } from 'lucide-react';
import type { SitePlan } from '../../types/project';
import { fileToPlanImage } from '../../utils/planImage';
import { CommandError, useLiveCommand } from '../../live/commands';

/** Where a plan of this aspect ratio sits in the current view: centred and
 *  filling the whole screen, without distortion, so in one direction it
 *  reaches past the edges. */
function planBoundsInView(map: L.Map, aspect: number): SitePlan['bounds'] {
  const size = map.getSize();
  const [w, h] = size.x / size.y > aspect ? [size.x, size.x / aspect] : [size.y * aspect, size.y];
  const a = map.containerPointToLatLng([size.x / 2 - w / 2, size.y / 2 + h / 2]);
  const b = map.containerPointToLatLng([size.x / 2 + w / 2, size.y / 2 - h / 2]);
  return [
    [a.lat, a.lng],
    [b.lat, b.lng],
  ];
}

/** Load, place and remove the site plan; with a process diagram open,
 *  load or remove that diagram's background instead. */
export function PlanControls({
  map,
  canvasKey,
  sitePlan,
  onSitePlanChange,
  canvasPlans,
  onCanvasPlansChange,
}: {
  map: L.Map | null;
  canvasKey: string | null;
  sitePlan?: SitePlan | null;
  onSitePlanChange: (plan: SitePlan | null) => void;
  canvasPlans: Record<string, string>;
  onCanvasPlansChange?: (plans: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const onCanvas = canvasKey !== null && !!onCanvasPlansChange;

  // The AI loads a plan the same way: a file (PNG, JPG or PDF, base64), for
  // the site or, with `subprocess` ("g0" a process, "s3" a subprocess), as the
  // background of that diagram.
  useLiveCommand('load_site_plan', async (args) => {
    const bytes = Uint8Array.from(atob(String(args.data ?? '')), (c) => c.charCodeAt(0));
    const file = new File([bytes], String(args.filename ?? 'plan'), {
      type: String(args.mime ?? ''),
    });
    const img = await fileToPlanImage(file);
    const target = args.subprocess ? String(args.subprocess) : null;
    if (target) {
      if (!onCanvasPlansChange) throw new CommandError('Diagram backgrounds cannot be set here.');
      onCanvasPlansChange({ ...canvasPlans, [target]: img.url });
    } else {
      if (!map) throw new CommandError('The map is not ready yet.');
      onSitePlanChange({ url: img.url, bounds: planBoundsInView(map, img.width / img.height) });
    }
    return { target: target ?? 'site', width: img.width, height: img.height };
  });
  const hasPlan = onCanvas ? !!canvasPlans[canvasKey!] : !!sitePlan;

  const load = async (file: File) => {
    setBusy(true);
    setError(false);
    try {
      const img = await fileToPlanImage(file);
      if (onCanvas) onCanvasPlansChange!({ ...canvasPlans, [canvasKey!]: img.url });
      else if (map)
        onSitePlanChange({
          url: img.url,
          bounds: planBoundsInView(map, img.width / img.height),
        });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const aspect = () => {
    const [[s, w], [n, e]] = sitePlan!.bounds;
    const p1 = map!.latLngToContainerPoint([s, w]);
    const p2 = map!.latLngToContainerPoint([n, e]);
    return Math.abs(p2.x - p1.x) / Math.abs(p2.y - p1.y);
  };

  return (
    <div className="map-plan-controls">
      <button
        className="pa-btn"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        title={t(onCanvas ? 'map.plan_canvas' : 'map.plan_upload')}
      >
        {busy ? <LoaderCircle size={16} className="pa-spin" /> : <ImagePlus size={16} />}
        <span>{t('map.plan')}</span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) load(f);
          e.target.value = '';
        }}
      />
      {hasPlan && !onCanvas && sitePlan && (
        <>
          <button
            className="pa-btn"
            onClick={() =>
              map && onSitePlanChange({ ...sitePlan, bounds: planBoundsInView(map, aspect()) })
            }
            title={t('map.plan_place')}
          >
            <Scan size={16} />
          </button>
        </>
      )}
      {hasPlan && (
        <button
          className="pa-btn"
          onClick={() => {
            if (onCanvas) {
              const next = { ...canvasPlans };
              delete next[canvasKey!];
              onCanvasPlansChange!(next);
            } else onSitePlanChange(null);
          }}
          title={t('map.plan_remove')}
        >
          <Trash2 size={16} />
        </button>
      )}
      {error && <span className="map-plan-error">{t('map.plan_error')}</span>}
    </div>
  );
}

// ─── Stream Circles Overlay ─────────────────────────────────────────────────
// Draws SVG bubble circles on the map above each process group, matching the
// Streamlit app: circle SIZE = Q heat power (kW, globally min-max scaled),
// COLOR = continuous blue→red gradient based on global temperature range.
