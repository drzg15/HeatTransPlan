/** Load a whole case (a saved file, an example, or one an AI loads) in place
 *  of what the page holds. The scenarios of the previous case go with it:
 *  they describe streams that are no longer there. null starts an empty one. */

import type { ProjectState } from '../types/project';
import { useAnalysisStore } from './analysisStore';
import { useProjectStore } from './projectStore';

export function loadProject(state: ProjectState | null) {
  const project = useProjectStore.getState();
  if (state) project.setState(state);
  else project.resetState();
  useAnalysisStore.getState().resetScenarios();
}
