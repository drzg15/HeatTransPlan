# Graph Report - HeatTransPlan  (2026-09-07)

## Corpus Check
- 151 files · ~282,202 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1428 nodes · 2797 edges · 97 communities (52 shown, 28 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 103 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1fb06219`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- 654
- bootstrap.js
- Pinch
- is
- optimization_service.py
- react
- ps
- trigger
- ReportRequest
- get_project
- HeatPumpIntegration
- types/analysis.ts
- models/analysis.py
- io_routes.py
- ProjectState
- ci
- PotentialAnalysisPage.tsx
- package.json
- DataCollectionPage.tsx
- StreamModel
- compilerOptions
- Ai
- devDependencies
- compilerOptions
- Qi
- Zs
- MapViewer.tsx
- heat_profiles.py
- Pinch Analysis
- Pinch Analysis
- ProcessNode
- routers/analysis.py
- mo
- StreamDataTable.tsx
- HeatTransPlan
- english-stemmer.js
- pydata-sphinx-theme.js
- dependencies
- process.ts
- Ss
- searchtools.js
- projects.ts
- PinchRequest
- ISSP
- geo_utils.py
- Heat Pump Integration — Classic Method
- ye
- Heat Pump Integration — Classic Method
- projectSchema.ts
- export_cop_ranges.py
- Heat Pump Optimization — Predictive ML Model & Grid Search
- addCopyButtonToCodeCells
- fn
- Heat Pump Optimization — Predictive ML Model & Grid Search
- process.py
- import_csv
- list_projects
- scripts
- fe
- vite.config.ts
- copybutton_funcs.js
- doctools.js
- sphinx_highlight.js
- React + TypeScript + Vite
- Qn
- react-plotly.d.ts
- config_optimization.py
- HeatTransPlan — Calculation Logic
- HeatTransPlan — Calculation Logic
- lint-staged
- tsconfig.json
- documentation_options.js
- setupTests.ts
- GEMINI.md
- heattransplan-backend
- ._getConfig
- tn
- ve
- useProjectStore
- ErrorBoundaryClass

## God Nodes (most connected - your core abstractions)
1. `654()` - 55 edges
2. `ps` - 40 edges
3. `useAnalysisStore` - 31 edges
4. `ci` - 29 edges
5. `trigger()` - 27 edges
6. `react` - 25 edges
7. `react-i18next` - 25 edges
8. `get_project()` - 23 edges
9. `ye` - 23 edges
10. `Qi` - 23 edges

## Surprising Connections (you probably didn't know these)
- `ol()` --indirect_call--> `N()`  [INFERRED]
  docs/_build/html/_static/scripts/fontawesome.js → docs/_build/html/_static/scripts/pydata-sphinx-theme.js
- `run_hpi_optimization()` --uses--> `PinchResult`  [INFERRED]
  backend/app/services/optimization_service.py → backend/app/models/analysis.py
- `heat_pump_integration()` --uses--> `HPIRequest`  [INFERRED]
  backend/app/routers/analysis.py → backend/app/models/analysis.py
- `status_quo_comparison()` --uses--> `StatusQuoRequest`  [INFERRED]
  backend/app/routers/analysis.py → backend/app/models/analysis.py
- `run_status_quo()` --uses--> `StatusQuoRequest`  [INFERRED]
  backend/app/services/analysis_service.py → backend/app/models/analysis.py

## Import Cycles
- None detected.

## Communities (97 total, 28 thin omitted)

### Community 0 - "654"
Cohesion: 0.06
Nodes (55): d(), e(), h(), i(), m(), r(), v(), q() (+47 more)

### Community 1 - "bootstrap.js"
Cohesion: 0.06
Nodes (49): ae(), B(), ce(), ct(), D(), de(), dt(), _e() (+41 more)

### Community 2 - "Pinch"
Cohesion: 0.05
Nodes (11): PinchMain, PinchExport, Pinch, PinchPlot, Streams, TotalSiteProfile, TSPPlot, SplitStreams (+3 more)

### Community 4 - "optimization_service.py"
Cohesion: 0.08
Nodes (41): AST, HPIOptimizationDiagnostics, HPIOptimizationRequest, OptimizedIntegrationPoint, Why the optimization found little or nothing. Filled on every run, so an empty…, Input to the HPI optimization endpoint., Return the (source, sink) profiles for `mode`. For 'net_load' this delegates to…, resolve_profiles() (+33 more)

### Community 5 - "react"
Cohesion: 0.11
Nodes (22): getExample(), App(), DataCollectionPage, PotentialAnalysisPage, AppShell(), NAV_ITEMS, Props, Language (+14 more)

### Community 7 - "trigger"
Cohesion: 0.16
Nodes (3): remove(), Sn, trigger()

### Community 8 - "ReportRequest"
Cohesion: 0.10
Nodes (33): HeatPumpEntry, HPIOptimizationResult, PinchResult, Full output of pinch analysis., Detailed summary of an available heat pump., BaseModel, Report request/response models., Stream data for report generation. (+25 more)

### Community 9 - "get_project"
Cohesion: 0.10
Nodes (35): ProcessNode, A node in the process hierarchy. Exactly mirrors create_process_node(). Level 0…, add_child(), add_group(), add_subprocess(), delete_child(), delete_group(), delete_subprocess() (+27 more)

### Community 10 - "HeatPumpIntegration"
Cohesion: 0.10
Nodes (13): carnot_cop(), HeatPumpIntegration, in_operating_window(), ValueError, A heat pump needs a positive temperature lift. With the pocket-free GCC the…, Best COP available at source temperature T, across every technology rated for…, Returns list of all heat pump types with their COPs and availability status, COP of one named technology at source temperature T. Raises HeatPumpOutOfRange… (+5 more)

### Community 11 - "types/analysis.ts"
Cohesion: 0.12
Nodes (27): validateCopFormula(), CopFormulaModal(), DEFAULT_COP_FORMULA, EXAMPLES, Props, HeatRecoveryToggle(), ModeOption, AnalysisStore (+19 more)

### Community 12 - "models/analysis.py"
Cohesion: 0.12
Nodes (29): CompositeDiagramData, CopFormulaSpec, CopFormulaValidateRequest, CopFormulaValidateResult, EnergyDemand, HPIntegrationResult, HPIRequest, HPIResult (+21 more)

### Community 13 - "io_routes.py"
Cohesion: 0.09
Nodes (24): verify_api_key(), health(), get, serve_frontend(), get_example(), get_process_models(), list_examples(), get (+16 more)

### Community 14 - "ProjectState"
Cohesion: 0.10
Nodes (27): GroupCoordinates, ProjectState, BaseModel, Project state model — exact mirror of save_app_state() / load_app_state() in…, Coordinates and metadata for a process group on the map., Complete project state. Matches save_app_state() output exactly. This is what…, create_project(), delete_project() (+19 more)

### Community 16 - "PotentialAnalysisPage.tsx"
Cohesion: 0.17
Nodes (21): generateReport(), runHPI(), runHPIOptimization(), runPinch(), runStatusQuo(), CompositeCurvesChart(), GrandCompositeCurveChart(), HeatPumpTable() (+13 more)

### Community 17 - "package.json"
Cohesion: 0.09
Nodes (23): name, private, type, version, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+15 more)

### Community 18 - "DataCollectionPage.tsx"
Cohesion: 0.17
Nodes (15): HP_COLORS, HPIChart(), HPIOptimizationChart(), Props, HPIOptimizationPanel(), isSamePoint(), SortKey, Props (+7 more)

### Community 19 - "StreamModel"
Cohesion: 0.13
Nodes (19): BaseModel, Stream data model. Field names mirror the original Streamlit create_stream()…, Legacy property labels (prop1..prop4)., Legacy property values (val1..val4)., A single energy stream. Matches create_stream() output exactly. Both legacy…, StreamModel, StreamProperties, StreamType (+11 more)

### Community 20 - "compilerOptions"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 22 - "devDependencies"
Cohesion: 0.10
Nodes (20): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, husky, jsdom (+12 more)

### Community 23 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 26 - "MapViewer.tsx"
Cohesion: 0.12
Nodes (8): createDivIcon(), GroupCoords, Props, StreamCirclesOverlay(), streamColor(), TILE_URLS, leaflet, react-leaflet

### Community 27 - "heat_profiles.py"
Cohesion: 0.21
Nodes (16): build_heat_profiles(), _composite_curve(), _composite_profiles(), _curve(), _profiles_from_interval_loads(), Any, Source/sink heat profiles for heat pump integration. Three levels of heat-…, Build one composite curve using shifted temperatures. Returns (T ascending, H… (+8 more)

### Community 28 - "Pinch Analysis"
Cohesion: 0.12
Nodes (16): Construction, Deletion Algorithm, Input: Process Streams, Key results, Pass 1: Unfeasible Cascade (no external utility), Pass 2: Feasible Cascade, Pinch Analysis, Pipeline Summary (+8 more)

### Community 29 - "Pinch Analysis"
Cohesion: 0.12
Nodes (16): Construction, Deletion Algorithm, Input: Process Streams, Key results, Pass 1: Unfeasible Cascade (no external utility), Pass 2: Feasible Cascade, Pinch Analysis, Pipeline Summary (+8 more)

### Community 30 - "ProcessNode"
Cohesion: 0.21
Nodes (10): StreamCirclesOverlayProps, GroupCoords, ProcessGroupList(), Props, Props, SubprocessCard(), ProjectStore, ProcessNode (+2 more)

### Community 31 - "routers/analysis.py"
Cohesion: 0.17
Nodes (15): generate_report(), get_map_preview(), heat_pump_integration(), post, Analysis router — pinch, HPI, status quo, report endpoints., Generate process map with drawn streams., Run heat pump integration analysis., Check a user COP formula and evaluate it at one sample point. Called as the… (+7 more)

### Community 33 - "StreamDataTable.tsx"
Cohesion: 0.27
Nodes (12): Props, SortKey, StreamDataTable(), exportDistanceMatrixToCsv(), exportLiveMapSnapshot(), exportProjectToCsv(), haversineDistance(), manhattanSphericalDistance() (+4 more)

### Community 34 - "HeatTransPlan"
Cohesion: 0.12
Nodes (15): 1 — Clone the repository, 2 — Start the backend, 3 — Start the frontend (separate terminal), Backend, Environment Variables, Features, Frontend, Getting Started (+7 more)

### Community 35 - "english-stemmer.js"
Cohesion: 0.22
Nodes (8): r_R1(), r_R2(), r_shortv(), r_Step_1b(), r_Step_2(), r_Step_3(), r_Step_4(), r_Step_5()

### Community 36 - "pydata-sphinx-theme.js"
Cohesion: 0.20
Nodes (10): c(), e(), f(), g(), I(), L(), N(), p() (+2 more)

### Community 37 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, axios, html2canvas, i18next, leaflet, plotly.js, react, react-dom (+7 more)

### Community 38 - "process.ts"
Cohesion: 0.16
Nodes (14): ALL_VARS, DEFAULT_VARS, Props, STREAM_TYPES, StreamEditor(), UNIT_OPTIONS, DEFAULT_STREAM, ExtraInfo (+6 more)

### Community 40 - "searchtools.js"
Cohesion: 0.19
Nodes (6): _displayItem(), _displayNextItem(), _escapeHTML(), _finishSearch(), Search, SearchResultKind

### Community 42 - "PinchRequest"
Cohesion: 0.22
Nodes (12): PinchRequest, PinchStream, A single stream for pinch analysis input., Input to the pinch analysis endpoint., pinch_analysis(), Run pinch analysis on provided streams., PinchResult, Execute pinch analysis by writing a temp CSV in the format expected by Streams,… (+4 more)

### Community 44 - "geo_utils.py"
Cohesion: 0.21
Nodes (11): haversine_distance(), lonlat_to_tile_xy(), Geo utilities — extracted from data_collection.py. Web Mercator projection +…, Convert lon/lat to tile x/y at given zoom level., Convert tile x/y to lon/lat at given zoom level., Convert pixel coordinates (relative to image top-left) to lon/lat., Convert lon/lat to pixel coordinates on a snapshot image., Calculate the great circle distance in meters between two points. (+3 more)

### Community 45 - "Heat Pump Integration — Classic Method"
Cohesion: 0.17
Nodes (11): At each source temperature $T$:, Best-Available COP Selection, Carnot Fallback, Convergence, COP Correlations, Detailed Mode Breakdown, Heat Pump Integration — Classic Method, Heat Pump Technologies and Operating Windows (+3 more)

### Community 47 - "Heat Pump Integration — Classic Method"
Cohesion: 0.17
Nodes (11): At each source temperature $T$:, Best-Available COP Selection, Carnot Fallback, Convergence, Detailed Mode Breakdown, Heat Pump Integration — Classic Method, Heat Pump Technologies and Operating Windows, Integration Walk: Finding the Operating Point (+3 more)

### Community 48 - "projectSchema.ts"
Cohesion: 0.17
Nodes (11): extraInfoSchema, groupCoordinatesSchema, processModelSelectionSchema, processNodeSchema, processParamsSchema, projectStateSchema, streamPropertiesSchema, streamSchema (+3 more)

### Community 49 - "export_cop_ranges.py"
Cohesion: 0.24
Nodes (10): build_ranges(), check_against_model(), main(), Path, Export the COP model's validity ranges to a small JSON file. The optimizer…, Warn if the ranges and the model disagree on the known categories. A…, Normalise the German dataset labels to the values the API returns., Aggregate the modelling frame into one entry per (stage, medium). (+2 more)

### Community 50 - "Heat Pump Optimization — Predictive ML Model & Grid Search"
Cohesion: 0.18
Nodes (10): 1. Source-Sink Energy Balance, 2. Zero-Crossing Exact Point Detection, 2D Mesh Grid Search Algorithm, Custom COP Formula Evaluation, Heat Pump Optimization — Predictive ML Model & Grid Search, Output Summary, Predictive ML Model & Refrigerant Alternatives, Refrigerant Data Schema (+2 more)

### Community 51 - "addCopyButtonToCodeCells"
Cohesion: 0.27
Nodes (8): addCopyButtonToCodeCells(), escapeRegExp(), formatCopyText(), clearSelection(), codeCellId(), messages, temporarilyChangeIcon(), temporarilyChangeTooltip()

### Community 53 - "Heat Pump Optimization — Predictive ML Model & Grid Search"
Cohesion: 0.18
Nodes (10): 1. Source-Sink Energy Balance, 2. Zero-Crossing Exact Point Detection, 2D Mesh Grid Search Algorithm, Custom COP Formula Evaluation, Heat Pump Optimization — Predictive ML Model & Grid Search, Output Summary, Predictive ML Model & Refrigerant Alternatives, Refrigerant Data Schema (+2 more)

### Community 55 - "process.py"
Cohesion: 0.28
Nodes (8): ExtraInfo, ProcessModelSelection, ProcessParams, BaseModel, Process node data model. Field names mirror the original Streamlit…, Extended process metadata., Category selection from process_models.json., Process parameters for thermal power calculation.

### Community 56 - "import_csv"
Cohesion: 0.25
Nodes (9): import_csv(), import_json(), import_json_body(), post, ProjectState, Import process data from CSV., Import a project state from a JSON file (same format as save_app_state()).…, Import a project state from JSON body (for example loading). Creates a new… (+1 more)

### Community 58 - "list_projects"
Cohesion: 0.29
Nodes (7): get_project(), list_projects(), get, List all project IDs and timestamps., Get full project state by ID., list_projects(), Return dict of project_id → timestamp for all projects.

### Community 59 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, prepare, preview, test

### Community 61 - "vite.config.ts"
Cohesion: 0.40
Nodes (3): apiProxy, vite, @vitejs/plugin-react

### Community 64 - "sphinx_highlight.js"
Cohesion: 0.67
Nodes (3): _highlight(), _highlightText(), SphinxHighlight

### Community 65 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 67 - "react-plotly.d.ts"
Cohesion: 0.50
Nodes (3): PlotProps, react-plotly.js, plotly.js

### Community 71 - "lint-staged"
Cohesion: 0.67
Nodes (3): lint-staged, *.{css,md,json}, *.{ts,tsx}

### Community 95 - "useProjectStore"
Cohesion: 0.21
Nodes (11): EnergyDemands(), StreamSelector(), ActionBar(), BASE_OPTIONS, Props, defaultState, useProjectStore, StreamInfo (+3 more)

## Knowledge Gaps
- **227 isolated node(s):** `heattransplan-backend`, `messages`, `BLACKLISTED_KEY_CONTROL_ELEMENTS`, `Documentation`, `DOCUMENTATION_OPTIONS` (+222 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 606 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `de()` connect `bootstrap.js` to `react`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `react-i18next` connect `react` to `StreamDataTable.tsx`, `process.ts`, `types/analysis.ts`, `PotentialAnalysisPage.tsx`, `package.json`, `DataCollectionPage.tsx`, `ProcessNode`, `useProjectStore`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `ps` connect `ps` to `bootstrap.js`, `is`, `ye`, `Ai`, `Qi`, `._getConfig`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `654()` (e.g. with `dc()` and `hc()`) actually correct?**
  _`654()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `heattransplan-backend`, `messages`, `BLACKLISTED_KEY_CONTROL_ELEMENTS` to the rest of the system?**
  _227 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `654` be split into smaller, more focused modules?**
  _Cohesion score 0.0640503517215846 - nodes in this community are weakly interconnected._
- **Should `bootstrap.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06306306306306306 - nodes in this community are weakly interconnected._