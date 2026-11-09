import { useEffect, useRef, useState } from 'react';
import { Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * BoxSelector: Handles Click-and-Drag area selection on the map.
 * Re-implemented with direct DOM events for maximum reliability on locked maps.
 * The box is drawn on the screen, not in lat/lon, so it stays a rectangle on a
 * rotated map; `onSelect` gets a test for whether a point lies inside it.
 */
export function BoxSelector({
  onSelect,
  active,
  locked,
}: {
  onSelect: (inBox: (latlng: L.LatLngExpression) => boolean) => void;
  active: boolean;
  locked: boolean;
}) {
  const map = useMap();
  const [corners, setCorners] = useState<L.LatLng[] | null>(null);
  const startRef = useRef<L.Point | null>(null);

  useEffect(() => {
    if (!active) return;

    const container = map.getContainer();
    const box = (e: MouseEvent) => L.bounds(startRef.current!, map.mouseEventToContainerPoint(e));
    // The screen rectangle's four corners, back on the map.
    const toCorners = (b: L.Bounds) =>
      [b.min!, L.point(b.max!.x, b.min!.y), b.max!, L.point(b.min!.x, b.max!.y)].map((p) =>
        map.containerPointToLatLng(p)
      );

    const onDown = (e: MouseEvent) => {
      // 1. Only left click
      if (e.button !== 0) return;

      // 2. Ignore UI
      const target = e.target as HTMLElement;
      if (
        target.closest('.leaflet-control') ||
        target.closest('.pa-map-toolbar') ||
        target.closest('.leaflet-marker-icon')
      ) {
        return;
      }

      // 3. Start selection
      startRef.current = map.mouseEventToContainerPoint(e);
      setCorners(null);

      // Prevent map panning
      map.dragging.disable();
    };

    const onMove = (e: MouseEvent) => {
      if (!startRef.current) return;
      setCorners(toCorners(box(e)));
    };

    // On a locked map dragging must stay off; only restore it when unlocked.
    const restoreDragging = () => {
      if (!locked) map.dragging.enable();
    };

    const onUp = (e: MouseEvent) => {
      if (!startRef.current) {
        restoreDragging();
        return;
      }

      const bounds = box(e);
      const [a, , c] = toCorners(bounds);

      // Clean up state immediately
      startRef.current = null;
      setCorners(null);
      restoreDragging();

      // Trigger selection if meaningful distance
      if (a.distanceTo(c) > 1.0) {
        onSelect((latlng) => bounds.contains(map.latLngToContainerPoint(latlng)));
      }
    };

    L.DomEvent.on(container, 'mousedown', onDown as any);
    L.DomEvent.on(window as any, 'mousemove', onMove as any);
    L.DomEvent.on(window as any, 'mouseup', onUp as any);

    return () => {
      L.DomEvent.off(container, 'mousedown', onDown as any);
      L.DomEvent.off(window as any, 'mousemove', onMove as any);
      L.DomEvent.off(window as any, 'mouseup', onUp as any);
      restoreDragging();
      // Switched off (or re-wired) mid-drag: drop the half-drawn box.
      startRef.current = null;
      setCorners(null);
    };
  }, [active, map, onSelect, locked]);

  if (!active || !corners) return null;
  return (
    <Polygon
      positions={corners}
      pathOptions={{
        color: '#3498db',
        weight: 2,
        dashArray: '6, 8',
        fillOpacity: 0.15,
        interactive: false,
      }}
    />
  );
}
