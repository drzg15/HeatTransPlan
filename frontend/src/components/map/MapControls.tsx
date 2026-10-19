import { useEffect, useMemo } from 'react';
import { Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

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
    // `tap` only exists in older Leaflet builds and is missing from the typings.
    const tap = (map as L.Map & { tap?: L.Handler }).tap;
    if (locked) {
      map.setView(center, zoom, { animate: false });
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
      if (map.touchZoom) map.touchZoom.disable();
      if (tap) tap.disable();
    } else if (!frozen) {
      // Only when nothing else is holding the map still. This effect reruns on
      // every centre/zoom change, so without the guard it would re-enable
      // panning behind the freeze's back.
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
      if (map.touchZoom) map.touchZoom.enable();
      if (tap) tap.enable();
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

export function SubprocessCanvasOverlay({ active, deps }: { active: boolean; deps?: unknown }) {
  const map = useMap();
  // Read from the map when it is switched on and whenever deps change, so the
  // canvas follows the map if needed — and only then, not on every render.
  const view = useMemo(
    () => (active ? { center: map.getCenter(), size: map.getSize() } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is the trigger to re-read the map
    [active, map, deps]
  );

  if (!view) return null;
  const { center, size } = view;

  // Use 90% of the viewport dimensions
  const width = size.x * 0.9;
  const height = size.y * 0.9;

  // By using a DOM-based Marker instead of a vector Rectangle, we completely bypass
  // Leaflet's SVG renderer limitations with custom panes.
  const bgIcon = L.divIcon({
    className: 'subprocess-canvas-bg',
    html: `<div style="width: ${width}px; height: ${height}px; margin-left: -${width / 2}px; margin-top: -${height / 2}px; background: var(--surface, #ffffff); opacity: 0.91; pointer-events: none; border-radius: 12px; border: 1px solid var(--border, #e0e0e0); box-shadow: 0 8px 32px rgba(0,0,0,0.08);"></div>`,
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
