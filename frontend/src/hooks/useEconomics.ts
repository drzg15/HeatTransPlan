/** The economic analysis numbers from the backend, refetched when an input
 *  changes. Requests wait until the inputs have been still for a moment, so
 *  dragging a slider sends one request, not one per step; an answer that
 *  arrives after a newer request was sent is dropped. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { runEconomics } from '../api/analysis';
import type { HPIOptimizationResult, OptimizedIntegrationPoint } from '../types/analysis';
import type { EconNumbers } from '../types/economics';

const DEBOUNCE_MS = 250;

export interface EconJob {
  selected: OptimizedIntegrationPoint[];
  opt: HPIOptimizationResult | null | undefined;
}

/** One analysis per job (e.g. per saved scenario), all with the same inputs. */
export function useEconomicsList(
  jobs: EconJob[],
  form: Record<string, number>,
  refType: string,
  sensBase: { fuel: number; el: number } | null = null
) {
  const [numbers, setNumbers] = useState<Array<EconNumbers | null>>([]);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const id = ++latest.current;
    const timer = setTimeout(() => {
      Promise.all(jobs.map((j) => runEconomics(form, refType, j.selected, j.opt, sensBase)))
        .then((all) => {
          if (id !== latest.current) return;
          setNumbers(all);
          setError(null);
        })
        .catch((e: unknown) => {
          if (id === latest.current) setError(e instanceof Error ? e.message : String(e));
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [jobs, form, refType, sensBase]);

  return { numbers, error };
}

/** The analysis of the one pump on the page. */
export function useEconomics(
  form: Record<string, number>,
  refType: string,
  selected: OptimizedIntegrationPoint[],
  opt: HPIOptimizationResult | null | undefined,
  sensBase: { fuel: number; el: number } | null = null
) {
  const jobs = useMemo(() => [{ selected, opt }], [selected, opt]);
  const { numbers, error } = useEconomicsList(jobs, form, refType, sensBase);
  return { numbers: numbers[0] ?? null, error };
}
