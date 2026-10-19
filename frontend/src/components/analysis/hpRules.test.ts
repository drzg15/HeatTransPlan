/// <reference types="node" />
// The contract file is read from disk, so this one test needs Node's types.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { OptimizedIntegrationPoint } from '../../types/analysis';
import {
  activePointsOf,
  boxPointOf,
  chartPointsOf,
  DEFAULT_TABLE_SORT,
  defaultHighlightOf,
  highlightedPumpOf,
  sortRows,
  tableRowsOf,
  thinnedCloudOf,
} from './hpRules';

// The contract the page and the report both answer to. The page's rules are
// the reference, so this test is where 'expected' is recorded:
//   UPDATE_CONTRACT=1 npx vitest run hpRules
// Tests run from frontend/, locally and in CI.
const CONTRACT = resolve(process.cwd(), '../contracts/hp_rules.json');
const contract = JSON.parse(readFileSync(CONTRACT, 'utf8'));

type Point = OptimizedIntegrationPoint;
const key = (p: Point | null) => (p ? `${p.refrigerant}@${p.T_sink}@${p.T_source}` : null);
// Sets where order is not a rule; the table's opening order is checked on its own.
const keys = (ps: Point[]) => ps.map(key).sort();

function apply(points: Point[], maxQ: Point | null, selected: Point[]) {
  // The report has no filter controls, so it runs with the page's defaults:
  // every filter on 'All', archetypes shown, off-profile points hidden.
  const chartPoints = chartPointsOf(points);
  const highlight = defaultHighlightOf(chartPoints, maxQ);
  const active = activePointsOf(highlight, selected);
  const cloud = thinnedCloudOf(chartPoints, highlight, selected);
  return {
    chart_points: keys(chartPoints),
    default_highlight: key(highlight),
    table_rows: keys(tableRowsOf(points, true, selected)),
    // The order the table opens in, before anyone clicks a column header.
    table_order: sortRows(tableRowsOf(points, true, selected), DEFAULT_TABLE_SORT).map(key),
    cloud_real: keys(cloud.real),
    cloud_theoretical: keys(cloud.theoretical),
    // In order: the box goes to the last one picked.
    active_points: active.map(key),
    box_point: key(boxPointOf(active)),
  };
}

describe('heat pump display rules', () => {
  const actual: Record<string, ReturnType<typeof apply>> = {};
  const cases = contract.cases as Record<string, { max_q_point: Point; selected: Point[] }>;
  for (const [name, c] of Object.entries(cases)) {
    actual[name] = apply(contract.points, c.max_q_point, c.selected);
  }
  // With nothing on the profiles, the chart falls back to every point.
  actual.only_off_profile = apply(contract.only_off_profile, null, []);

  if (process.env.UPDATE_CONTRACT === '1') {
    contract.expected = actual;
    writeFileSync(CONTRACT, JSON.stringify(contract, null, 2) + '\n');
  }

  for (const name of Object.keys(actual)) {
    it(`matches the contract: ${name}`, () => {
      expect(actual[name]).toEqual(contract.expected[name]);
    });
  }
});

describe('the pump the comparison table rates coverage with', () => {
  // The status quo comparison and the report must name the machine the chart
  // boxes: the contract's box_point, case by case.
  const cases = contract.cases as Record<string, { max_q_point: Point; selected: Point[] }>;
  for (const [name, c] of Object.entries(cases)) {
    it(`is the boxed pump: ${name}`, () => {
      expect(key(highlightedPumpOf(contract.points, c.max_q_point, c.selected))).toBe(
        contract.expected[name].box_point
      );
    });
  }
});
