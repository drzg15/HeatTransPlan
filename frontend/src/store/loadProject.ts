/** Load a whole case (a saved file, an example, or one an AI loads) in place
 *  of what the page holds. The scenarios of the previous case go with it:
 *  they describe streams that are no longer there. null starts an empty one. */

import type { ProjectState } from '../types/project';
import { useAnalysisStore } from './analysisStore';
import { useProjectStore } from './projectStore';
import { useUIStore } from './uiStore';

export function loadProject(state: ProjectState | null) {
  const project = useProjectStore.getState();
  if (state) project.setState(state);
  else project.resetState();
  useAnalysisStore.getState().resetScenarios();
  // Open the first process and its first subprocess, so data collection shows
  // its streams straight away. Also clears what was open in the previous case.
  const first = state?.proc_groups?.[0]?.[0];
  useUIStore.setState({
    expandedGroups: new Set(first === undefined ? [] : [0]),
    expandedSubprocesses: new Set(first === undefined ? [] : [first]),
    activeSections: {},
  });
}
