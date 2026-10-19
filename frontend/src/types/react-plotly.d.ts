declare module 'react-plotly.js' {
  // No @types/plotly.js is installed, so traces, layouts and configs stay
  // open-ended records; only the fields the app reads back are typed.
  export type PlotlyObject = Record<string, unknown>;

  export interface PlotPoint {
    x?: unknown;
    y?: unknown;
    customdata?: unknown;
    [key: string]: unknown;
  }

  export interface PlotEvent {
    points?: PlotPoint[];
    [key: string]: unknown;
  }

  interface PlotProps {
    data: PlotlyObject[];
    layout?: PlotlyObject;
    config?: PlotlyObject;
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    onInitialized?: (figure: PlotlyObject, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: PlotlyObject, graphDiv: HTMLElement) => void;
    onPurge?: (figure: PlotlyObject, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    onClick?: (event: PlotEvent) => void;
    onHover?: (event: PlotEvent) => void;
    onUnhover?: (event: PlotEvent) => void;
    onSelected?: (event: PlotEvent) => void;
    onRelayout?: (event: PlotlyObject) => void;
    revision?: number;
  }

  const Plot: React.FC<PlotProps>;
  export default Plot;
}
