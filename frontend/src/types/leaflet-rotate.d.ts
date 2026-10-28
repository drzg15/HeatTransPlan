/** leaflet-rotate ships no types: the parts the map uses. */
import 'leaflet';

declare module 'leaflet' {
  interface MapOptions {
    rotate?: boolean;
    bearing?: number;
    rotateControl?: boolean;
    shiftKeyRotate?: boolean;
    touchRotate?: boolean;
  }
  interface Map {
    setBearing(degrees: number): void;
    getBearing(): number;
    shiftKeyRotate: Handler;
    touchRotate: Handler;
  }
}
