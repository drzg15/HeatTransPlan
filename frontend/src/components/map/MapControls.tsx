/** Invisible helpers that drive the Leaflet map (lock, fit, sync, freeze), the
 *  subprocess canvas behind diagrams, and the rotate buttons. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';

export function MapController({
  center,
  zoom,
  locked,
  frozen,
}: {
  center: [number, number];
  zoom: number;
  locked: boolean;
  /** True while a diagram is open: the map must stay exactly where it is. */
  frozen: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (locked) {
      map.setView(center, zoom, { animate: false });
      map.dragging.disable();
      // Zooming stays: locking is about placing things, not about the view.
      // Around the centre, so a locked map cannot drift sideways.
      L.setOptions(map, { scrollWheelZoom: 'center', touchZoom: 'center' });
      if (frozen) map.scrollWheelZoom.disable();
      else map.scrollWheelZoom.enable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      if ((map as any).touchZoom) (map as any).touchZoom[frozen ? 'disable' : 'enable']();
      if ((map as any).tap) (map as any).tap.disable();
    } else if (!frozen) {
      L.setOptions(map, { scrollWheelZoom: true, touchZoom: true });
      // Only when nothing else is holding the map still. This effect reruns on
      // every centre/zoom change, so without the guard it would re-enable
      // panning behind the freeze's back.
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      if ((map as any).touchZoom) (map as any).touchZoom.enable();
      if ((map as any).tap) (map as any).tap.enable();
    }
  }, [center, zoom, locked, frozen, map]);
  return null;
}

export function MapMoveHandler({
  onMoveEnd,
  locked,
}: {
  onMoveEnd: (center: [number, number], zoom: number) => void;
  locked: boolean;
}) {
  useMapEvents({
    moveend(e) {
      if (locked) return;
      const map = e.target;
      const c = map.getCenter();
      onMoveEnd([c.lat, c.lng], map.getZoom());
    },
  });
  return null;
}

export function MapFullscreenResizer({ active }: { active: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const delays = [50, 200, 500];
    const timers = delays.map((d) => setTimeout(() => map.invalidateSize(), d));
    return () => timers.forEach((t) => clearTimeout(t));
  }, [active, map]);
  return null;
}

export function MapClickHandler({ onClick }: { onClick?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      if (onClick) onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Called once on mount: invalidates the Leaflet container size, waits a tick
 * for Leaflet to recalculate its internal pixel grid, then snaps the view to
 * the correct center/zoom. invalidateSize and setView MUST be in separate
 * timeouts — calling them together means setView runs before Leaflet has
 * finished updating its size math, causing the "cut-off corner" bug.
 */
export function MapMountFitter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Step 1: force Leaflet to measure the real container size
    const invalidate = () => map.invalidateSize({ animate: false });
    // Step 2: after size is known, snap to correct center+zoom
    const refit = () => map.setView(center, zoom, { animate: false });

    timers.push(setTimeout(invalidate, 0));
    timers.push(setTimeout(refit, 50));
    timers.push(setTimeout(invalidate, 100));
    timers.push(setTimeout(refit, 150));
    timers.push(setTimeout(invalidate, 300));
    timers.push(setTimeout(refit, 400));

    return () => timers.forEach((t) => clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

export function MapCenterSync({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    const current = map.getCenter();
    const currentZoom = map.getZoom();
    // Only fly if the distance is greater than 10 meters or the zoom level changed.
    // This prevents jitter/interruption when the map is just sending moveend events back up.
    const dist = current.distanceTo(L.latLng(center[0], center[1]));
    if (dist > 10 || currentZoom !== zoom) {
      map.flyTo(center, zoom, { duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
}

/**
 * Freezes the map while a group's diagram is open.
 *
 * A node's position on screen is project(lat, lon, zoom) measured against the
 * map centre, so it depends on exactly two things: the centre and the zoom.
 * The white canvas, by contrast, is fixed to the viewport. Pan the map and the
 * nodes slide across a stationary canvas and out of it — no amount of bounds,
 * zoom-fitting or label-shrinking changes that, because the two are anchored
 * to different things.
 *
 * Holding the centre and zoom still pins every node, connector and label at
 * once, with no per-element change: the diagram and its canvas become one
 * fixed unit and the map is a backdrop. Collapse the group and the map is
 * interactive again, with the nodes back on their own coordinates.
 */
export function SubprocessMapFreeze({ active, locked }: { active: boolean; locked: boolean }) {
  const map = useMap();

  useEffect(() => {
    // A locked map has already disabled all of this; leave it alone so that
    // unfreezing here cannot re-enable interaction it deliberately turned off.
    if (!active || locked) return;

    const handlers = [
      map.dragging,
      map.scrollWheelZoom,
      map.doubleClickZoom,
      map.boxZoom,
      map.keyboard,
      map.touchZoom,
    ].filter((h) => h && h.enabled());

    handlers.forEach((h) => h.disable());
    return () => handlers.forEach((h) => h.enable());
  }, [active, locked, map]);

  return null;
}

export function SubprocessCanvasOverlay({
  active,
  deps,
  image,
}: {
  active: boolean;
  deps?: any;
  image?: string;
}) {
  const map = useMap();
  // The map's center and size, taken again whenever deps change, so the canvas
  // follows the map. Taken while rendering, not in an effect: no empty frame.
  const key = JSON.stringify(deps ?? null);
  const [view, setView] = useState<{ key: string; center: L.LatLng; size: L.Point } | null>(null);
  if (active && view?.key !== key) {
    setView({ key, center: map.getCenter(), size: map.getSize() });
  } else if (!active && view) {
    setView(null);
  }

  if (!active || !view) return null;
  const { center, size } = view;

  // Use 90% of the viewport dimensions
  const width = size.x * 0.9;
  const height = size.y * 0.9;

  // By using a DOM-based Marker instead of a vector Rectangle, we completely bypass
  // Leaflet's SVG renderer limitations with custom panes.
  const bgIcon = L.divIcon({
    className: 'subprocess-canvas-bg',
    // The process's own plan, if one was loaded, fills the canvas behind the diagram.
    html: `<div style="width: ${width}px; height: ${height}px; margin-left: -${width / 2}px; margin-top: -${height / 2}px; background: var(--surface, #ffffff)${image ? ` url('${image}') center / contain no-repeat` : ''}; opacity: ${image ? 1 : 0.91}; pointer-events: none; border-radius: 12px; border: 1px solid var(--border, #e0e0e0); box-shadow: 0 8px 32px rgba(0,0,0,0.08);"></div>`,
    iconSize: [0, 0],
  });

  return (
    <Marker
      position={center}
      icon={bgIcon}
      pane="canvasPane"
      interactive={false}
      keyboard={false}
    />
  );
}

/**
 * Turns the map to the saved bearing and reports a turn once it settles.
 * While a diagram is open the map faces north and cannot turn: the diagram is
 * laid out on the screen, so it must look the same whatever the map's bearing.
 */
export function MapRotation({
  bearing,
  frozen,
  onRotateEnd,
}: {
  bearing: number;
  frozen: boolean;
  onRotateEnd?: (bearing: number) => void;
}) {
  const map = useMap();
  const holding = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The latest handler, so a parent re-render mid-turn does not drop the save.
  const report = useRef(onRotateEnd);
  useEffect(() => {
    report.current = onRotateEnd;
  });

  useEffect(() => {
    if (!frozen && Math.abs(L.Util.wrapNum(bearing, [0, 360]) - map.getBearing()) > 0.01)
      map.setBearing(bearing);
  }, [bearing, frozen, map]);

  useEffect(() => {
    if (!frozen) return;
    const before = map.getBearing();
    holding.current = true;
    map.setBearing(0);
    map.shiftKeyRotate.disable();
    map.touchRotate.disable();
    return () => {
      map.shiftKeyRotate.enable();
      map.touchRotate.enable();
      map.setBearing(before);
      holding.current = false;
    };
  }, [frozen, map]);

  useEffect(() => {
    const rotated = () => {
      if (holding.current || !report.current) return;
      clearTimeout(timer.current);
      // Shift + wheel turns in 5° steps: save once the turning stops.
      timer.current = setTimeout(
        () => report.current?.(Math.round(map.getBearing() * 10) / 10),
        300
      );
    };
    map.on('rotate', rotated);
    return () => {
      map.off('rotate', rotated);
      clearTimeout(timer.current);
    };
  }, [map]);
  return null;
}

/** Under the zoom buttons: turn left, face north (the compass needle shows
 *  where north is), turn right. */
export function RotateControls({ hidden }: { hidden: boolean }) {
  const map = useMap();
  const { t } = useTranslation();
  const [bearing, setBearing] = useState(map.getBearing());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sync = () => setBearing(map.getBearing());
    map.on('rotate', sync);
    return () => {
      map.off('rotate', sync);
    };
  }, [map]);
  useEffect(() => {
    if (!ref.current) return;
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);
  const button = (label: string, onClick: () => void, body: ReactNode) => (
    <a
      href="#"
      role="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      {body}
    </a>
  );
  return createPortal(
    <div
      ref={ref}
      className="leaflet-bar map-rotate-controls"
      style={{ display: hidden ? 'none' : undefined }}
    >
      {button(t('map.rotate_left'), () => map.setBearing(map.getBearing() - 15), '⟲')}
      {button(
        t('map.rotate'),
        () => map.setBearing(0),
        <svg width="16" height="16" viewBox="0 0 16 16" style={{ transform: `rotate(${bearing}deg)` }}>
          <path d="M8 1 L11 8 H5 Z" fill="#dc2626" />
          <path d="M8 15 L11 8 H5 Z" fill="currentColor" opacity="0.45" />
        </svg>
      )}
      {button(t('map.rotate_right'), () => map.setBearing(map.getBearing() + 15), '⟳')}
    </div>,
    map.getContainer()
  );
}
