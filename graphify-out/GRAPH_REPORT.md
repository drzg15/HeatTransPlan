# Graph Report - HeatTransPlan  (2026-09-18)

## Corpus Check
- 80 files · ~422,461 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1629 nodes · 3048 edges · 114 communities (62 shown, 34 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 146 edges (avg confidence: 0.88)
- Token cost: 216,188 input · 38,153 output

## Community Hubs (Navigation)
- Clipboard Vendor Bundle
- Bootstrap JS Bundle
- Pinch Analysis Engine
- Project State Persistence
- Process Tree CRUD API
- App Shell & Navigation
- Heat Pump Integration Core
- COP Formula Frontend
- Analysis Pydantic Models
- Report Generation Models
- Deployment & Pinch Provenance
- FastAPI App Bootstrap
- Bootstrap Carousel Widget
- Bootstrap Tooltip Internals
- Bootstrap Popover Config
- HPI Optimization Config
- HPI Chart Components
- ESLint & Package Manifest
- Tutorial Slides & Branding
- Analysis Router Endpoints
- Process Domain Models
- Safe COP Formula AST
- Bootstrap Dropdown Popper
- Pinch Methodology Docs
- Frontend TS App Config
- Bootstrap Collapse Widget
- Grid Search Optimization
- Bootstrap Toast Widget
- Frontend Dev Dependencies
- Analysis API Client
- Interactive Map Viewer
- Node TS Build Config
- Composite Heat Profiles
- Pinch Chart Components
- Bootstrap Tab Widget
- Screenshot Automation
- Map Rendering & Geo Utils
- Pinch Cascade Concepts
- Refrigerant & COP Limits
- Pinch Docs (Sphinx Build)
- Action Bar & Project Schema
- COP Model Selection
- Stream Editor UI
- Sphinx Search Stemmer
- Bootstrap Focus Trap
- Bootstrap Scrollspy
- PyData Sphinx Theme JS
- Frontend Runtime Deps
- Stream Table & CSV Export
- Bootstrap Tooltip Content
- Bootstrap jQuery Bridge
- Sphinx Search Tools
- Project API Client
- ISSP Site Profile Module
- Bootstrap Swipe Handler
- Bootstrap Config Base
- HP Integration Docs
- Sphinx Theme Icons
- HP Integration Docs (Build)
- HP Optimization Docs (Build)
- Project Zustand Store
- COP Range Export Script
- Docs Build Tooling
- Sphinx Copy Button
- Bootstrap Modal Widget
- Bootstrap Toast Append
- CSV & JSON Import
- HP Optimization Docs
- Streams CRUD Router
- NPM Script Targets
- Vite & Vitest Config
- Map Patch Codemod
- Copy Button Helpers
- Sphinx Doctools
- Sphinx Highlight
- Frontend README
- React Error Boundary
- Plotly Type Shims
- Arrow Patch Codemod
- Vertical Arrow Codemod
- Docs Index (Build)
- Docs Index
- Lint-Staged Config
- TS Project References
- Arrow Click Codemod
- Sphinx Toggle Icons
- Refrigerant Docs (Build)
- Sphinx Doc Options
- Build Tool Brand Assets
- Frontend Test Setup
- Graphify Project Notes
- Tutorial Update Script
- JupyterLite Docs Logo
- Tutorial Slide 3
- Tutorial Slide 4
- Backend Container Image

## God Nodes (most connected - your core abstractions)
1. `654()` - 55 edges
2. `ps` - 40 edges
3. `useAnalysisStore` - 30 edges
4. `ci` - 29 edges
5. `trigger()` - 27 edges
6. `react` - 27 edges
7. `react-i18next` - 27 edges
8. `Qi` - 23 edges
9. `ye` - 23 edges
10. `get_project()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Tutorial Slideshow (PDF)` --conceptually_related_to--> `HeatTransPlan Calculation Logic (docs root)`  [AMBIGUOUS]
  frontend/public/assets/tutorial/slideshow.pdf → docs/index.md
- `Embedded Raster Logo/Symbol Graphic` --conceptually_related_to--> `Frontend HTML App Shell`  [AMBIGUOUS]
  backend/app/data/symbol.svg → frontend/index.html
- `Graphify knowledge-graph query convention` --conceptually_related_to--> `HeatTransPlan`  [INFERRED]
  GEMINI.md → README.md
- `FastAPI backend (backend/app)` --implements--> `Heat Pump Integration (Classic Method)`  [INFERRED]
  README.md → docs/heat_pump_integration.md
- `Pre-trained COP model artefacts (models/)` --shares_data_with--> `Predictive ML COP regressor (joblib scikit-learn)`  [INFERRED]
  README.md → docs/_build/html/_sources/heat_pump_optimization.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Pinch analysis pipeline stages** — docs__build_html__sources_pinch_analysis_temperature_shifting, docs_pinch_analysis_temperature_intervals, docs__build_html__sources_pinch_analysis_problem_table, docs__build_html__sources_pinch_analysis_heat_cascade, docs_pinch_analysis_shifted_composite_diagram, docs_pinch_analysis_composite_diagram, docs_pinch_analysis_grand_composite_curve, docs_pinch_analysis_temperature_pocket_deletion [EXTRACTED 1.00]
- **Prototypical heat pump technology family with operating envelopes** — docs_heat_pump_integration_prototypical_stirling, docs_heat_pump_integration_vhthp_hfc_hfo, docs_heat_pump_integration_shp_hthp_hfc_hfo, docs_heat_pump_integration_shp_hthp_r717, docs__build_html__sources_heat_pump_integration_carnot_fallback, docs__build_html__sources_heat_pump_integration_hp_operating_windows [EXTRACTED 1.00]
- **Production deployment stack (compose services, docs pipeline, app tiers)** — docker_compose_backend_service, docker_compose_frontend_service, docker_compose_caddy_service, readme_backend_fastapi, readme_frontend_react_spa, github_workflows_docs_deploy_sphinx_docs_to_github_pages [INFERRED 0.85]
- **Pinch Analysis Pipeline Stages** — docs_pinch_analysis_temperature_shifting, docs_pinch_analysis_temperature_intervals, docs_pinch_analysis_problem_table, docs_pinch_analysis_heat_cascade, docs_pinch_analysis_shifted_composite_diagram, docs_pinch_analysis_composite_diagram, docs_pinch_analysis_grand_composite_curve, docs_pinch_analysis_temperature_pocket_deletion [EXTRACTED 1.00]
- **Prototypical Heat Pump COP Model Family** — docs_heat_pump_integration_prototypical_stirling, docs_heat_pump_integration_vhthp_hfc_hfo, docs_heat_pump_integration_shp_hthp_hfc_hfo, docs_heat_pump_integration_shp_hthp_r717, docs_heat_pump_integration_carnot_fallback [EXTRACTED 1.00]
- **Optimization Candidate Search Flow** — docs_heat_pump_optimization_refrigerant_data_schema, docs_heat_pump_optimization_temperature_approach_corrections, docs_heat_pump_optimization_predictive_ml_cop_model, docs_heat_pump_optimization_mesh_grid_search, docs_heat_pump_optimization_zero_crossing_detection, docs_heat_pump_optimization_source_limited_heat_pump_integration, docs_heat_pump_optimization_output_ranking [EXTRACTED 1.00]
- **HeatTransPlan Seven-Step Onboarding Walkthrough** — frontend_public_tutorial_step0_overview_getting_started, frontend_public_tutorial_step1_process_subprocess_stream_editor, frontend_public_tutorial_step2_geolocation, frontend_public_tutorial_step3_add_subprocess_data, frontend_public_tutorial_step4_stream_summary_selection, frontend_public_tutorial_step5_composite_curves, frontend_public_tutorial_step6_heat_pump_integration [EXTRACTED 1.00]
- **Pinch Analysis to Heat Pump Sizing Computation Chain** — frontend_public_tutorial_step4_current_energy_supply, frontend_public_tutorial_step5_pinch_analysis_kpis, frontend_public_tutorial_step6_net_load_curves_default, frontend_public_tutorial_step6_integrable_heat_pumps_table, frontend_public_tutorial_step4_status_quo_vs_proposal [INFERRED 0.85]
- **Tutorial Slide Deck (vector SVG exports, uniform 845x427pt)** — frontend_public_assets_tutorial_slide_1_slide, frontend_public_assets_tutorial_slide_2_slide, frontend_public_assets_tutorial_slide_3_slide, frontend_public_assets_tutorial_slide_4_slide, frontend_public_assets_tutorial_slide_5_slide, frontend_public_assets_tutorial_slide_6_slide, frontend_public_assets_tutorial_slide_7_slide [EXTRACTED 1.00]

## Communities (114 total, 34 thin omitted)

### Community 0 - "Clipboard Vendor Bundle"
Cohesion: 0.06
Nodes (55): d(), e(), h(), i(), m(), r(), v(), q() (+47 more)

### Community 1 - "Bootstrap JS Bundle"
Cohesion: 0.07
Nodes (48): ae(), B(), ce(), ct(), D(), de(), dt(), _e() (+40 more)

### Community 2 - "Pinch Analysis Engine"
Cohesion: 0.05
Nodes (11): PinchMain, PinchExport, Pinch, PinchPlot, Streams, TotalSiteProfile, TSPPlot, SplitStreams (+3 more)

### Community 3 - "Project State Persistence"
Cohesion: 0.09
Nodes (33): GroupCoordinates, ProjectState, BaseModel, Project state model — exact mirror of save_app_state() / load_app_state() in…, Coordinates and metadata for a process group on the map., Complete project state. Matches save_app_state() output exactly. This is what…, create_project(), delete_project() (+25 more)

### Community 4 - "Process Tree CRUD API"
Cohesion: 0.10
Nodes (36): add_child(), add_group(), add_subprocess(), delete_child(), delete_group(), delete_subprocess(), geo_search(), GeoQuery (+28 more)

### Community 5 - "App Shell & Navigation"
Cohesion: 0.09
Nodes (24): getExample(), App(), AppShell(), NAV_ITEMS, Props, Language, SUPPORTED_LANGUAGES, AnalysisHelp() (+16 more)

### Community 6 - "Heat Pump Integration Core"
Cohesion: 0.09
Nodes (15): carnot_cop(), HeatPumpIntegration, HeatPumpOutOfRange, in_operating_window(), ValueError, A heat pump needs a positive temperature lift. With the pocket-free GCC the…, Best COP available at source temperature T, across every technology rated for…, Returns list of all heat pump types with their COPs and availability status (+7 more)

### Community 7 - "COP Formula Frontend"
Cohesion: 0.11
Nodes (28): validateCopFormula(), BUILTIN_FORMULAS, CopFormulaModal(), DEFAULT_COP_FORMULA, Props, HeatRecoveryToggle(), ModeOption, AnalysisStore (+20 more)

### Community 8 - "Analysis Pydantic Models"
Cohesion: 0.11
Nodes (31): CompositeDiagramData, CopFormulaSpec, EnergyDemand, HPIntegrationResult, HPIRequest, HPIResult, PinchRequest, PinchStream (+23 more)

### Community 9 - "Report Generation Models"
Cohesion: 0.12
Nodes (30): HeatPumpEntry, HPIOptimizationResult, PinchResult, Full output of pinch analysis., Detailed summary of an available heat pump., BaseModel, Report request/response models., Stream data for report generation. (+22 more)

### Community 10 - "Deployment & Pinch Provenance"
Cohesion: 0.07
Nodes (32): docker-compose backend service, docker-compose caddy reverse proxy service, docker-compose frontend service, Read-only models volume mount, Linnhoff & Hindmarsh (1983), Pinch Analysis methodology, Process stream (CP, Ts, Tt, HOT/COLD), Rendered Pinch Analysis page (+24 more)

### Community 11 - "FastAPI App Bootstrap"
Cohesion: 0.09
Nodes (24): verify_api_key(), health(), get, serve_frontend(), get_example(), get_process_models(), list_examples(), get (+16 more)

### Community 13 - "Bootstrap Tooltip Internals"
Cohesion: 0.16
Nodes (3): remove(), Sn, trigger()

### Community 15 - "HPI Optimization Config"
Cohesion: 0.11
Nodes (24): Locate an asset regardless of where the server was started from. Compose mounts…, _resolve(), HPIOptimizationDiagnostics, HPIOptimizationRequest, OptimizedIntegrationPoint, Why the optimization found little or nothing. Filled on every run, so an empty…, Input to the HPI optimization endpoint., heat_pump_integration_optimization() (+16 more)

### Community 16 - "HPI Chart Components"
Cohesion: 0.14
Nodes (17): DataCollectionPage, HP_COLORS, HPIChart(), HPIOptimizationChart(), Props, HPIOptimizationPanel(), isSamePoint(), SortKey (+9 more)

### Community 17 - "ESLint & Package Manifest"
Cohesion: 0.09
Nodes (23): name, private, type, version, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+15 more)

### Community 18 - "Tutorial Slides & Branding"
Cohesion: 0.08
Nodes (25): Tutorial Slide 1 (vector export, 845x427pt), Tutorial Slide 2 (vector export, 845x427pt), Tutorial Slide 5 (vector export, 845x427pt), Tutorial Slide 6 (vector export, 845x427pt), Tutorial Slide 7 (vector export, 845x427pt), HeatTransPlan Favicon (gradient heat-flow arrow: blue to fuchsia to red), Cold-to-Hot Blue/Red Color Encoding, HeatTransPlan Two-Phase Workflow (Data Collection then Potential Analysis) (+17 more)

### Community 19 - "Analysis Router Endpoints"
Cohesion: 0.12
Nodes (23): CopFormulaValidateRequest, CopFormulaValidateResult, Input to the status quo comparison endpoint., Check a formula (and preview one value) without running the optimisation., StatusQuoRequest, generate_report(), get_map_preview(), pinch_analysis() (+15 more)

### Community 20 - "Process Domain Models"
Cohesion: 0.14
Nodes (21): ExtraInfo, ProcessModelSelection, ProcessNode, ProcessParams, BaseModel, Process node data model. Field names mirror the original Streamlit…, Extended process metadata., Category selection from process_models.json. (+13 more)

### Community 21 - "Safe COP Formula AST"
Cohesion: 0.13
Nodes (21): AST, build_variables(), _check_pow(), compile_formula(), cop_from_formula(), FormulaError, _IfExpToWhere, _literal_number() (+13 more)

### Community 23 - "Pinch Methodology Docs"
Cohesion: 0.09
Nodes (21): Embedded Raster Logo/Symbol Graphic, Construction, Deletion Algorithm, Input: Process Streams, Key results, Linnhoff & Hindmarsh (1983), Pass 1: Unfeasible Cascade (no external utility), Pass 2: Feasible Cascade (+13 more)

### Community 24 - "Frontend TS App Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 26 - "Grid Search Optimization"
Cohesion: 0.15
Nodes (20): Condenser duty from first-law balance, Heat recovery modes (full recovery vs no recovery), Source and sink heat profiles, Step-size refinement near convergence (÷200), Candidate ranking output (best_cop_points, source_limited_points, diagnostics), 2D (T_source, T_sink) mesh grid search, Source-limited integration (1% coverage threshold), Source-sink energy balance (Q_src_req) (+12 more)

### Community 28 - "Frontend Dev Dependencies"
Cohesion: 0.10
Nodes (20): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, husky, jsdom (+12 more)

### Community 29 - "Analysis API Client"
Cohesion: 0.23
Nodes (15): generateReport(), runHPI(), runHPIOptimization(), runPinch(), runStatusQuo(), PotentialAnalysisPage, EnergyDemands(), ScenarioComparison() (+7 more)

### Community 30 - "Interactive Map Viewer"
Cohesion: 0.11
Nodes (10): createDivIcon(), GroupCoords, Props, StreamArrowsOverlay(), StreamCirclesOverlay(), StreamCirclesOverlayProps, streamColor(), TILE_URLS (+2 more)

### Community 31 - "Node TS Build Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 32 - "Composite Heat Profiles"
Cohesion: 0.19
Nodes (18): build_heat_profiles(), _composite_curve(), _composite_profiles(), _curve(), _profiles_from_interval_loads(), Any, Source/sink heat profiles for heat pump integration. Three levels of heat-…, Build one composite curve using shifted temperatures. Returns (T ascending, H… (+10 more)

### Community 33 - "Pinch Chart Components"
Cohesion: 0.21
Nodes (12): CompositeCurvesChart(), GrandCompositeCurveChart(), HeatPumpTable(), PinchMetrics(), getBestHP(), StatusQuoComparison(), TemperatureIntervalDiagram(), ChartHelpButton() (+4 more)

### Community 35 - "Screenshot Automation"
Cohesion: 0.11
Nodes (15): puppeteer, author, dependencies, puppeteer, description, keywords, license, main (+7 more)

### Community 36 - "Map Rendering & Geo Utils"
Cohesion: 0.15
Nodes (14): Map rendering service. Generates images with process boxes and stream circles…, haversine_distance(), lonlat_to_tile_xy(), Geo utilities — extracted from data_collection.py. Web Mercator projection +…, Convert lon/lat to tile x/y at given zoom level., Convert tile x/y to lon/lat at given zoom level., Convert pixel coordinates (relative to image top-left) to lon/lat., Convert lon/lat to pixel coordinates on a snapshot image. (+6 more)

### Community 37 - "Pinch Cascade Concepts"
Cohesion: 0.15
Nodes (17): Shifted temperatures encode the physical lift, Heat cascade (two-pass, unfeasible then feasible), Minimum approach temperature (ΔTmin), Minimum hot and cold utility demand, Pinch analysis pipeline (PinchMain.solve_pinch), Problem Table (ΔT, ΔCP, ΔH), ΔTmin/2 temperature shifting, Shifted Temperatures Encode Physical Lift (+9 more)

### Community 38 - "Refrigerant & COP Limits"
Cohesion: 0.15
Nodes (17): Custom COP formula AST-validated compilation, Multi-stage heat pump levels (1/2/3) and sink medium, Refrigerant operating limits table, Rendered Heat Pump Optimization page, Rendered Refrigerant Limits page, Custom COP Formula (safe AST evaluation), Heat Pump Optimization (ML model and grid search), Predictive ML COP Model (joblib regressor) (+9 more)

### Community 39 - "Pinch Docs (Sphinx Build)"
Cohesion: 0.12
Nodes (16): Construction, Deletion Algorithm, Input: Process Streams, Key results, Pass 1: Unfeasible Cascade (no external utility), Pass 2: Feasible Cascade, Pinch Analysis, Pipeline Summary (+8 more)

### Community 40 - "Action Bar & Project Schema"
Cohesion: 0.13
Nodes (15): ActionBar(), BASE_OPTIONS, Props, extraInfoSchema, groupCoordinatesSchema, processModelSelectionSchema, processNodeSchema, processParamsSchema (+7 more)

### Community 41 - "COP Model Selection"
Cohesion: 0.17
Nodes (16): Best-available COP selection, Carnot COP fallback at 50% efficiency, HP_COP_CORRELATIONS empirical regressions, HP_OPERATING_WINDOWS (technology operating envelopes), Predictive ML COP regressor (joblib scikit-learn), Refrigerant alternatives schema (cop_ranges.json), Evaporator/condenser approach temperature corrections, Sphinx literalinclude test page (+8 more)

### Community 42 - "Stream Editor UI"
Cohesion: 0.17
Nodes (13): ALL_VARS, DEFAULT_VARS, Props, STREAM_TYPES, StreamEditor(), UNIT_OPTIONS, DEFAULT_STREAM, Props (+5 more)

### Community 43 - "Sphinx Search Stemmer"
Cohesion: 0.22
Nodes (8): r_R1(), r_R2(), r_shortv(), r_Step_1b(), r_Step_2(), r_Step_3(), r_Step_4(), r_Step_5()

### Community 46 - "PyData Sphinx Theme JS"
Cohesion: 0.20
Nodes (10): c(), e(), f(), g(), I(), L(), N(), p() (+2 more)

### Community 47 - "Frontend Runtime Deps"
Cohesion: 0.13
Nodes (15): dependencies, axios, html2canvas, i18next, leaflet, plotly.js, react, react-dom (+7 more)

### Community 48 - "Stream Table & CSV Export"
Cohesion: 0.24
Nodes (11): Props, SortKey, StreamDataTable(), exportDistanceMatrixToCsv(), exportLiveMapSnapshot(), haversineDistance(), manhattanSphericalDistance(), extractStreamInfo() (+3 more)

### Community 51 - "Sphinx Search Tools"
Cohesion: 0.19
Nodes (6): _displayItem(), _displayNextItem(), _escapeHTML(), _finishSearch(), Search, SearchResultKind

### Community 56 - "HP Integration Docs"
Cohesion: 0.17
Nodes (12): At each source temperature $T$:, Best-Available COP Selection, Carnot Fallback, Convergence, Detailed Mode Breakdown, Heat Pump Integration — Classic Method, Heat Pump Technologies and Operating Windows, HP Operating Windows (T_sink and lift envelopes) (+4 more)

### Community 57 - "Sphinx Theme Icons"
Cohesion: 0.18
Nodes (12): Tabler Check Icon (copybutton success), Tabler Copy Icon (copybutton), Sphinx File Icon (raster), Binder Launch Button Logo, Google Colab Launch Button Logo, Deepnote Launch Button Logo, JupyterHub Launch Button Logo, Built Search Page (Sphinx HTML output) (+4 more)

### Community 58 - "HP Integration Docs (Build)"
Cohesion: 0.17
Nodes (11): At each source temperature $T$:, Best-Available COP Selection, Carnot Fallback, Convergence, Detailed Mode Breakdown, Heat Pump Integration — Classic Method, Heat Pump Technologies and Operating Windows, Integration Walk: Finding the Operating Point (+3 more)

### Community 59 - "HP Optimization Docs (Build)"
Cohesion: 0.17
Nodes (11): 1. Source-Sink Energy Balance, 2. Zero-Crossing Exact Point Detection, 2D Mesh Grid Search Algorithm, Custom COP Formula Evaluation, Heat Pump Optimization — Predictive ML Model & Grid Search, Output Summary, Predictive ML Model & Refrigerant Alternatives, Refrigerant Data Schema (+3 more)

### Community 60 - "Project Zustand Store"
Cohesion: 0.30
Nodes (8): defaultState, ProjectStore, ExtraInfo, ProcessModelSelection, ProcessNode, ProcessParams, GroupCoordinates, ProjectState

### Community 61 - "COP Range Export Script"
Cohesion: 0.24
Nodes (10): build_ranges(), check_against_model(), main(), Path, Export the COP model's validity ranges to a small JSON file. The optimizer…, Warn if the ranges and the model disagree on the known categories. A…, Normalise the German dataset labels to the values the API returns., Aggregate the modelling frame into one entry per (stage, medium). (+2 more)

### Community 62 - "Docs Build Tooling"
Cohesion: 0.20
Nodes (11): HeatTransPlan Calculation Logic documentation, Toggle-block literalinclude documentation pattern, sphinx-book-theme asset macros, Bootstrap v5.3.3 (MIT), Font Awesome Free 7.2.0, pydata-sphinx-theme asset macros, Rendered general index page, Rendered docs index page (+3 more)

### Community 63 - "Sphinx Copy Button"
Cohesion: 0.27
Nodes (8): addCopyButtonToCodeCells(), escapeRegExp(), formatCopyText(), clearSelection(), codeCellId(), messages, temporarilyChangeIcon(), temporarilyChangeTooltip()

### Community 67 - "CSV & JSON Import"
Cohesion: 0.25
Nodes (9): import_csv(), import_json(), import_json_body(), post, ProjectState, Import process data from CSV., Import a project state from a JSON file (same format as save_app_state()).…, Import a project state from JSON body (for example loading). Creates a new… (+1 more)

### Community 68 - "HP Optimization Docs"
Cohesion: 0.22
Nodes (7): 1. Source-Sink Energy Balance, 2. Zero-Crossing Exact Point Detection, 2D Mesh Grid Search Algorithm, Custom COP Formula Evaluation, Heat Pump Optimization — Predictive ML Model & Grid Search, Output Summary, Refrigerant Operating Limits

### Community 70 - "Streams CRUD Router"
Cohesion: 0.29
Nodes (6): add_child_stream(), add_stream(), post, Streams router — CRUD for streams on any process node., Add a stream to a subprocess., Add a stream to a child node.

### Community 71 - "NPM Script Targets"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, prepare, preview, test

### Community 72 - "Vite & Vitest Config"
Cohesion: 0.40
Nodes (3): apiProxy, vite, @vitejs/plugin-react

### Community 73 - "Map Patch Codemod"
Cohesion: 0.40
Nodes (4): content, expandedBubblesStart, fs, insertionPoint

### Community 76 - "Sphinx Highlight"
Cohesion: 0.67
Nodes (3): _highlight(), _highlightText(), SphinxHighlight

### Community 77 - "Frontend README"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 79 - "Plotly Type Shims"
Cohesion: 0.50
Nodes (3): PlotProps, react-plotly.js, plotly.js

### Community 80 - "Arrow Patch Codemod"
Cohesion: 0.50
Nodes (3): content, fs, startIndex

### Community 81 - "Vertical Arrow Codemod"
Cohesion: 0.50
Nodes (3): content, fs, startIndex

### Community 84 - "Lint-Staged Config"
Cohesion: 0.67
Nodes (3): lint-staged, *.{css,md,json}, *.{ts,tsx}

## Ambiguous Edges - Review These
- `HeatTransPlan Calculation Logic (docs root)` → `Tutorial Slideshow (PDF)`  [AMBIGUOUS]
  frontend/public/assets/tutorial/slideshow.pdf · relation: conceptually_related_to
- `Frontend HTML App Shell` → `Embedded Raster Logo/Symbol Graphic`  [AMBIGUOUS]
  backend/app/data/symbol.svg · relation: conceptually_related_to

## Knowledge Gaps
- **306 isolated node(s):** `Language`, `Props`, `State`, `CompositeDiagramData`, `EnergyDemandInput` (+301 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 699 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `HeatTransPlan Calculation Logic (docs root)` and `Tutorial Slideshow (PDF)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Frontend HTML App Shell` and `Embedded Raster Logo/Symbol Graphic`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `de()` connect `Bootstrap JS Bundle` to `App Shell & Navigation`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Why does `react-i18next` connect `App Shell & Navigation` to `Pinch Chart Components`, `COP Formula Frontend`, `Action Bar & Project Schema`, `Stream Editor UI`, `HPI Chart Components`, `ESLint & Package Manifest`, `Stream Table & CSV Export`, `Analysis API Client`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `ps` connect `Bootstrap Popover Config` to `Bootstrap JS Bundle`, `Bootstrap Tooltip Internals`, `Bootstrap Tooltip Content`, `Bootstrap jQuery Bridge`, `Bootstrap Dropdown Popper`, `Bootstrap Config Base`, `Bootstrap Collapse Widget`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `654()` (e.g. with `dc()` and `hc()`) actually correct?**
  _`654()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Language`, `Props`, `State` to the rest of the system?**
  _306 weakly-connected nodes found - possible documentation gaps or missing edges._