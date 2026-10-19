import { useEffect, useRef, useState } from 'react';
import { Rectangle, useMap } from 'react-leaflet';
import L from 'leaflet';

/**
 * BoxSelector: Handles Click-and-Drag area selection on the map.
 * Re-implemented with direct DOM events for maximum reliability on locked maps.
 */
export function BoxSelector({
  onSelect,
  active,
  locked,
}: {
  onSelect: (bounds: L.LatLngBounds) => void;
  active: boolean;
  locked: boolean;
}) {
  const map = useMap();
  const [visualBounds, setVisualBounds] = useState<L.LatLngBounds | null>(null);
  const startLatLngRef = useRef<L.LatLng | null>(null);

  // Switching the selector off drops the rectangle in the same render.
  if (!active && visualBounds) setVisualBounds(null);

  useEffect(() => {
    if (!active) {
      startLatLngRef.current = null;
      return;
    }

    const container = map.getContainer();

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
      const latlng = map.mouseEventToLatLng(e);
      startLatLngRef.current = latlng;
      setVisualBounds(null);

      // Prevent map panning
      map.dragging.disable();
    };

    const onMove = (e: MouseEvent) => {
      if (!startLatLngRef.current) return;

      const currentLatLng = map.mouseEventToLatLng(e);
      const bounds = L.latLngBounds(startLatLngRef.current, currentLatLng);
      setVisualBounds(bounds);
    };

    // On a locked map dragging must stay off; only restore it when unlocked.
    const restoreDragging = () => {
      if (!locked) map.dragging.enable();
    };

    const onUp = (e: MouseEvent) => {
      if (!startLatLngRef.current) {
        restoreDragging();
        return;
      }

      const currentLatLng = map.mouseEventToLatLng(e);
      const bounds = L.latLngBounds(startLatLngRef.current, currentLatLng);

      // Clean up state immediately
      startLatLngRef.current = null;
      setVisualBounds(null);
      restoreDragging();

      // Trigger selection if meaningful distance
      if (bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 1.0) {
        onSelect(bounds);
      }
    };

    // Leaflet types its DOM helpers for HTMLElement and plain Events.
    const win = window as unknown as HTMLElement;
    const down = onDown as unknown as (e: Event) => void;
    const move = onMove as unknown as (e: Event) => void;
    const up = onUp as unknown as (e: Event) => void;
    L.DomEvent.on(container, 'mousedown', down);
    L.DomEvent.on(win, 'mousemove', move);
    L.DomEvent.on(win, 'mouseup', up);

    return () => {
      L.DomEvent.off(container, 'mousedown', down);
      L.DomEvent.off(win, 'mousemove', move);
      L.DomEvent.off(win, 'mouseup', up);
      restoreDragging();
    };
  }, [active, map, onSelect, locked]);

  if (!visualBounds) return null;
  return (
    <Rectangle
      bounds={visualBounds}
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
