declare module 'react-plotly.js' {
  interface PlotProps {
    data: any[];
    layout?: any;
    config?: any;
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    onInitialized?: (figure: any, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: any, graphDiv: HTMLElement) => void;
    onPurge?: (figure: any, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    onClick?: (event: any) => void;
    onHover?: (event: any) => void;
    onUnhover?: (event: any) => void;
    onSelected?: (event: any) => void;
    onRelayout?: (event: any) => void;
    // Returning false stops Plotly's own show/hide on a legend click.
    onLegendClick?: (event: any) => boolean;
    onLegendDoubleClick?: (event: any) => boolean;
    revision?: number;
  }

  const Plot: React.FC<PlotProps>;
  export default Plot;
}

// The partial bundle in components/analysis/Plot.ts.
declare module 'react-plotly.js/factory' {
  import type Plot from 'react-plotly.js';
  export default function createPlotlyComponent(plotly: object): typeof Plot;
}
declare module 'plotly.js/lib/core' {
  const Plotly: { register(modules: object[]): void };
  export default Plotly;
}
declare module 'plotly.js/lib/bar' {
  const trace: object;
  export default trace;
}
declare module 'plotly.js/lib/heatmap' {
  const trace: object;
  export default trace;
}
