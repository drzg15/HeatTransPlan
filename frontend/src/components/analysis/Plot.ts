/** Plotly with only the trace types the app draws: scatter (in the core), bar
 *  and heatmap. The full bundle carries maps, 3-D and WebGL besides, several
 *  megabytes nobody uses. A chart with another trace type registers it here. */

import Plotly from 'plotly.js/lib/core';
import bar from 'plotly.js/lib/bar';
import heatmap from 'plotly.js/lib/heatmap';
import createPlotlyComponent from 'react-plotly.js/factory';

Plotly.register([bar, heatmap]);

export default createPlotlyComponent(Plotly);
