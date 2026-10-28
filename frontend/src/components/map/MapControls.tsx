/** Invisible helpers that drive the Leaflet map (lock, fit, sync, freeze), the
 *  subprocess canvas behind diagrams, and the zoom slider. */

import { useEffect, useRef, useState } from 'react';
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
  const [center, setCenter] = useState<L.LatLng | null>(null);
  const [size, setSize] = useState<L.Point | null>(null);

  // We re-evaluate the center whenever deps change to ensure the canvas follows the map if needed
  useEffect(() => {
    if (active) {
      setCenter(map.getCenter());
      setSize(map.getSize());
    } else {
      setCenter(null);
      setSize(null);
    }
  }, [active, map, deps]);

  if (!active || !center || !size) return null;

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

/** Smooth zoom: a slider under the +/− buttons, in the same quarter steps. */
export function ZoomSlider({ hidden }: { hidden: boolean }) {
  const map = useMap();
  const { t } = useTranslation();
  const [z, setZ] = useState(map.getZoom());
  const ref = useRef<HTMLDivElement>(null);
  useMapEvents({ zoomend: () => setZ(map.getZoom()) });
  useEffect(() => {
    // Dragging the slider must not pan or zoom the map underneath.
    if (!ref.current) return;
    L.DomEvent.disableClickPropagation(ref.current);
    L.DomEvent.disableScrollPropagation(ref.current);
  }, []);
  return createPortal(
    <div ref={ref} className="map-zoom-slider" style={{ display: hidden ? 'none' : undefined }}>
      <input
        type="range"
        min={3}
        max={map.getMaxZoom()}
        step={0.25}
        value={z}
        onChange={(e) => {
          const v = Number(e.target.value);
          setZ(v);
          map.setZoom(v, { animate: false });
        }}
        aria-label={t('map.zoom')}
        title={t('map.zoom')}
      />
    </div>,
    map.getContainer()
  );
}
