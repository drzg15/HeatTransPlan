# Graph Report - HeatTransPlan  (2026-10-28)

## Corpus Check
- 84 files · ~471,056 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1844 nodes · 3727 edges · 122 communities (71 shown, 35 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 148 edges (avg confidence: 0.89)
- Token cost: 176,018 input · 0 output

## Community Hubs (Navigation)
- Docs Bootstrap Vendor JS
- Docs Clipboard Vendor JS
- Pinch Solver Core
- Economics Model
- Docs Vendor Swipe JS
- Analysis API Models
- HPI Optimization Config
- Stream Table and ActionBar
- Docs Vendor Tooltip JS
- Frontend Analysis API
- COP Formula UI
- Composite Curves and Pockets
- Process Hierarchy Routes
- Analysis Result Models
- API Client and IO
- Analysis Cards and Toggles
- HTML Report Service
- App Config and Entry
- Project State Model
- Heat Pump Integration Core
- Map Viewer
- Docs Vendor Modal JS
- Map Rendering Service
- Docs Vendor Carousel JS
- HPI Method Docs
- Tutorial Images
- HP Optimization Docs
- Economic Analysis Docs
- Frontend Package Config
- COP Formula Parser
- Stream Model
- App Shell and Routing
- TS App Config
- Docs Vendor Toggle JS
- Refrigerant Limits
- Frontend Dev Deps
- TS Node Config
- README Overview
- Heat Profiles
- Docs Vendor Tab JS
- Ai
- ._getOffset()
- docs/pinch_analysis.md
- puppeteer
- Key Results (minimum utility demand, pin
- dependencies
- StreamEditor.tsx
- Heat Recovery Modes (with / without heat
- Construction
- docs/heat_pump_optimization.md
- english-stemmer.js
- .jQueryInterface()
- pydata-sphinx-theme.js
- Ss
- searchtools.js
- issp.py
- Heat Pump Integration — Classic Method (
- export_cop_ranges.py
- copybutton.js
- projectSchema.ts
- generate_report()
- process.py
- import_csv()
- docs/heat_pump_integration.md
- get_project()
- scripts
- planImage.ts
- HeatTransPlan Calculation Logic (docs in
- locales.test.ts
- hpi_plot.py
- vite.config.ts
- 1 — Clone the repository
- docker-compose backend service
- sphinx-book-theme asset macros
- copybutton_funcs.js
- doctools.js
- sphinx_highlight.js
- lint-staged
- frontend/README.md
- ErrorBoundaryClass
- react-plotly.d.ts
- Embedded Raster Logo/Symbol Graphic
- Sphinx File Icon (raster)
- docs/index.md
- i18n.ts
- tsconfig.json
- docs.yml build job (sphinx-build)
- Sphinx Collapse Icon (11x11 grayscale mi
- _sources/refrigerant_limits.md
- documentation_options.js
- Vite Logo (build tool brand asset)
- setupTests.ts
- update-tutorial.sh
- ValueError
- Any
- Tabler Check Icon (copybutton success)
- Tabler Copy Icon (copybutton)
- Binder Launch Button Logo
- Google Colab Launch Button Logo
- Deepnote Launch Button Logo
- JupyterHub Launch Button Logo
- JupyterLite Logo (docs in-browser notebo
- Rendered general index page
- Tutorial Slide 3 (vector export, 845x427
- Tutorial Slide 4 (vector export, 845x427
- heattransplan-backend

## God Nodes (most connected - your core abstractions)
1. `654()` - 55 edges
2. `ps` - 40 edges
3. `useAnalysisStore` - 40 edges
4. `react-i18next` - 36 edges
5. `react` - 34 edges
6. `Economic Analysis of the Heat Pump` - 30 edges
7. `ci` - 29 edges
8. `trigger()` - 27 edges
9. `useProjectStore` - 24 edges
10. `Qi` - 23 edges

## Surprising Connections (you probably didn't know these)
- `Tutorial Slideshow (PDF)` --conceptually_related_to--> `HeatTransPlan Calculation Logic (docs index)`  [AMBIGUOUS]
  frontend/public/assets/tutorial/slideshow.pdf → docs/index.md
- `Embedded Raster Logo/Symbol Graphic` --conceptually_related_to--> `Frontend HTML App Shell`  [AMBIGUOUS]
  backend/app/data/symbol.svg → frontend/index.html
- `Pinch Analysis Pipeline` --references--> `PinchMain`  [EXTRACTED]
  docs/_build/html/_sources/pinch_analysis.md → backend/app/modules/pinch_main.py
- `Process Streams (hot/cold classification by T_S vs T_T)` --references--> `Streams`  [EXTRACTED]
  docs/_build/html/_sources/pinch_analysis.md → backend/app/modules/pinch/streams.py
- `Temperature Pocket Deletion` --references--> `TemperaturePocketDeletion`  [EXTRACTED]
  docs/pinch_analysis.md → backend/app/modules/utility/temperature_pocket_deletion.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **HeatTransPlan Seven-Step Onboarding Walkthrough** — frontend_public_tutorial_step0_overview_getting_started, frontend_public_tutorial_step1_process_subprocess_stream_editor, frontend_public_tutorial_step2_geolocation, frontend_public_tutorial_step3_add_subprocess_data, frontend_public_tutorial_step4_stream_summary_selection, frontend_public_tutorial_step5_composite_curves, frontend_public_tutorial_step6_heat_pump_integration [EXTRACTED 1.00]
- **Tutorial Slide Deck (vector SVG exports, uniform 845x427pt)** — frontend_public_assets_tutorial_slide_1_slide, frontend_public_assets_tutorial_slide_2_slide, frontend_public_assets_tutorial_slide_3_slide, frontend_public_assets_tutorial_slide_4_slide, frontend_public_assets_tutorial_slide_5_slide, frontend_public_assets_tutorial_slide_6_slide, frontend_public_assets_tutorial_slide_7_slide [EXTRACTED 1.00]
- **Pinch Analysis to Heat Pump Sizing Computation Chain** — frontend_public_tutorial_step4_current_energy_supply, frontend_public_tutorial_step5_pinch_analysis_kpis, frontend_public_tutorial_step6_net_load_curves_default, frontend_public_tutorial_step6_integrable_heat_pumps_table, frontend_public_tutorial_step4_status_quo_vs_proposal [INFERRED 0.85]
- **Production deployment stack (compose services, docs pipeline, app tiers)** — docker_compose_backend_service, docker_compose_frontend_service, docker_compose_caddy_service, github_workflows_docs_deploy_sphinx_docs_to_github_pages [INFERRED 0.85]
- **Pinch Analysis Pipeline (shift -> intervals -> problem table -> cascade -> curves -> pocket deletion)** — docs_pinch_analysis_temperature_shifting, docs_pinch_analysis_temperature_intervals, docs_pinch_analysis_problem_table, docs_pinch_analysis_heat_cascade, docs_pinch_analysis_grand_composite_curve, docs_pinch_analysis_temperature_pocket_deletion, docs_heat_pump_integration_heat_pump_integration [EXTRACTED 1.00]
- **Heat Pump Technology Archetypes (shared by integration and optimization)** — docs_heat_pump_integration_prototypical_stirling, docs_heat_pump_integration_vhthp_hfc_hfo, docs_heat_pump_integration_shp_hthps_hfc_hfo, docs_heat_pump_integration_shp_hthps_r717, docs_heat_pump_integration_carnot_fallback, docs_heat_pump_optimization_technology_archetypes [EXTRACTED 1.00]
- **VDI 4646 Economic Results (Detailed results)** — docs_economic_analysis_static_payback, docs_economic_analysis_internal_rate_of_return, docs_economic_analysis_lcoh, docs_economic_analysis_finnish_allocation_factor, docs_economic_analysis_vdi_cost_function, docs_economic_analysis_vdi_4646 [EXTRACTED 1.00]
- **Pinch Analysis Pipeline Steps** — docs_build_html_sources_pinch_analysis_temperature_shifting, docs_pinch_analysis_temperature_intervals, docs_pinch_analysis_problem_table, docs_pinch_analysis_heat_cascade, docs_pinch_analysis_shifted_composite_diagram, docs_pinch_analysis_composite_diagram, docs_pinch_analysis_grand_composite_curve, docs_pinch_analysis_temperature_pocket_deletion [EXTRACTED 1.00]
- **Heat Pump Technology Archetypes** — docs_heat_pump_integration_prototypical_stirling, docs_build_html_sources_heat_pump_integration_vhthp_hfc_hfo, docs_heat_pump_integration_shp_hthps_hfc_hfo, docs_heat_pump_integration_shp_hthps_r717, docs_build_html_sources_heat_pump_integration_carnot_fallback [EXTRACTED 1.00]
- **Heat Pump Optimization Grid Search Flow** — docs_build_html_sources_heat_pump_optimization_mesh_grid_search, docs_build_html_sources_heat_pump_optimization_source_sink_energy_balance, docs_heat_pump_optimization_zero_crossing_detection, docs_build_html_sources_heat_pump_optimization_source_limited_heat_pump_integration, docs_build_html_sources_heat_pump_optimization_demand_limited_integration, docs_build_html_sources_heat_pump_optimization_max_duty_tie_break [INFERRED 0.85]

## Communities (122 total, 35 thin omitted)

### Community 0 - "Docs Bootstrap Vendor JS"
Cohesion: 0.05
Nodes (48): ae(), B(), ce(), ct(), D(), de(), dt(), _e() (+40 more)

### Community 1 - "Docs Clipboard Vendor JS"
Cohesion: 0.06
Nodes (56): d(), e(), h(), i(), m(), r(), v(), q() (+48 more)

### Community 2 - "Pinch Solver Core"
Cohesion: 0.05
Nodes (10): PinchMain, PinchExport, Pinch, PinchPlot, Streams, TotalSiteProfile, TSPPlot, SplitStreams (+2 more)

### Community 3 - "Economics Model"
Cohesion: 0.08
Nodes (52): BOOL_FIELDS, buildEconomics(), COLORS, DEFAULTS, econCore(), FIELDS, Fig, GREEN (+44 more)

### Community 4 - "Docs Vendor Swipe JS"
Cohesion: 0.06
Nodes (6): fe(), ge(), getDataAttributes(), is, tn, ve

### Community 5 - "Analysis API Models"
Cohesion: 0.08
Nodes (47): CompositeDiagramData, CopFormulaSpec, CopFormulaValidateRequest, CopFormulaValidateResult, EnergyDemand, HPIntegrationResult, HPIRequest, HPIResult (+39 more)

### Community 6 - "HPI Optimization Config"
Cohesion: 0.07
Nodes (40): Locate an asset regardless of where the server was started from. Compose mounts…, _resolve(), HPIOptimizationDiagnostics, HPIOptimizationRequest, Why the optimization found little or nothing. Filled on every run, so an empty…, Input to the HPI optimization endpoint., heat_pump_integration_optimization(), Run data-driven heat pump integration optimization. (+32 more)

### Community 7 - "Stream Table and ActionBar"
Cohesion: 0.11
Nodes (30): Props, SortKey, StreamDataTable(), ActionBar(), BASE_OPTIONS, Props, GroupCoords, ProcessGroupList() (+22 more)

### Community 8 - "Docs Vendor Tooltip JS"
Cohesion: 0.09
Nodes (3): on(), ps, vs

### Community 9 - "Frontend Analysis API"
Cohesion: 0.08
Nodes (30): generateReport(), runHPI(), runHPIOptimization(), runPinch(), runStatusQuo(), CopCoverageChart(), econReportData(), EnergyDemands() (+22 more)

### Community 10 - "COP Formula UI"
Cohesion: 0.10
Nodes (29): validateCopFormula(), BUILTIN_FORMULAS, CopFormulaModal(), DEFAULT_COP_FORMULA, Props, Form, RefType, HPIOptimizationChart() (+21 more)

### Community 11 - "Composite Curves and Pockets"
Cohesion: 0.14
Nodes (27): CompositeCurvesChart(), NumInput(), gccPockets(), Pockets, side(), GrandCompositeCurveChart(), pairedTempRange(), LABEL_INK (+19 more)

### Community 12 - "Process Hierarchy Routes"
Cohesion: 0.10
Nodes (35): ProcessNode, A node in the process hierarchy. Exactly mirrors create_process_node(). Level 0…, add_child(), add_group(), add_subprocess(), delete_child(), delete_group(), delete_subprocess() (+27 more)

### Community 13 - "Analysis Result Models"
Cohesion: 0.13
Nodes (32): HeatPumpEntry, HPIOptimizationResult, OptimizedIntegrationPoint, PinchResult, Full output of pinch analysis., Detailed summary of an available heat pump., BaseModel, Report request/response models. (+24 more)

### Community 15 - "Analysis Cards and Toggles"
Cohesion: 0.12
Nodes (18): HP_COLORS, HPIChart(), LINKED, Props, ChartHelpButton(), Props, Props, Props (+10 more)

### Community 16 - "HTML Report Service"
Cohesion: 0.12
Nodes (31): Any, _active_points(), _best(), _de(), _fmt(), _headline_point(), _map_b64_cached(), _on_profile() (+23 more)

### Community 17 - "App Config and Entry"
Cohesion: 0.09
Nodes (24): verify_api_key(), health(), get, serve_frontend(), get_example(), get_process_models(), list_examples(), get (+16 more)

### Community 18 - "Project State Model"
Cohesion: 0.10
Nodes (27): GroupCoordinates, ProjectState, BaseModel, Project state model — exact mirror of save_app_state() / load_app_state() in…, Coordinates and metadata for a process group on the map., Complete project state. Matches save_app_state() output exactly. This is what…, create_project(), delete_project() (+19 more)

### Community 19 - "Heat Pump Integration Core"
Cohesion: 0.11
Nodes (14): carnot_cop(), HeatPumpIntegration, HeatPumpOutOfRange, in_operating_window(), A heat pump needs a positive temperature lift. With the pocket-free GCC the…, Best COP available at source temperature T, across every technology rated for…, Returns list of all heat pump types with their COPs and availability status, COP of one named technology at source temperature T. Raises HeatPumpOutOfRange… (+6 more)

### Community 20 - "Map Viewer"
Cohesion: 0.08
Nodes (17): createDivIcon(), GroupCoords, planBoundsInView(), PlanControls(), Props, StreamArrowsOverlay(), StreamCirclesOverlay(), StreamCirclesOverlayProps (+9 more)

### Community 21 - "Docs Vendor Modal JS"
Cohesion: 0.13
Nodes (4): Qn, remove(), Sn, trigger()

### Community 22 - "Map Rendering Service"
Cohesion: 0.12
Nodes (24): generate_process_map_b64(), Map rendering service. Generates images with process boxes and stream circles…, Generate a base64 encoded PNG image of the map with processes and streams…, haversine_distance(), lonlat_to_tile_xy(), Geo utilities — extracted from data_collection.py. Web Mercator projection +…, Convert lon/lat to tile x/y at given zoom level., Convert tile x/y to lon/lat at given zoom level. (+16 more)

### Community 24 - "HPI Method Docs"
Cohesion: 0.17
Nodes (24): At each source temperature $T$:, Best-Available COP Selection, Carnot Fallback, Convergence, COP Cap of 15.0, Prototypical Heat Pump COP Regression, Detailed Mode Breakdown, Heat Pump Integration — Classic Method (+16 more)

### Community 25 - "Tutorial Images"
Cohesion: 0.08
Nodes (25): Tutorial Slide 1 (vector export, 845x427pt), Tutorial Slide 2 (vector export, 845x427pt), Tutorial Slide 5 (vector export, 845x427pt), Tutorial Slide 6 (vector export, 845x427pt), Tutorial Slide 7 (vector export, 845x427pt), HeatTransPlan Favicon (gradient heat-flow arrow: blue to fuchsia to red), Cold-to-Hot Blue/Red Color Encoding, HeatTransPlan Two-Phase Workflow (Data Collection then Potential Analysis) (+17 more)

### Community 26 - "HP Optimization Docs"
Cohesion: 0.13
Nodes (23): _calculation_details(), The formula behind one point's COP, with its own temperatures filled in.…, Condenser Duty Energy Balance (Q_ko = Q_ev / (1 - 1/COP)), 1. Source-Sink Energy Balance, 2. Zero-Crossing Exact Point Detection, 2D Mesh Grid Search Algorithm, cop_ranges.json Refrigerant Alternatives Database, Custom COP Formula Evaluation (safe AST) (+15 more)

### Community 27 - "Economic Analysis Docs"
Cohesion: 0.17
Nodes (23): Annuity Factor, Break-even Electricity Price, Gross vs Net Calorific Value (Hs/Hi), Danish Energy Agency Technology Data - Industrial Process Heat (2026), Dynamic Payback, Economic Analysis of the Heat Pump, Annual Energy Flows and CO2 Emissions, Finnish Allocation Factor (+15 more)

### Community 28 - "Frontend Package Config"
Cohesion: 0.10
Nodes (21): name, private, type, version, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+13 more)

### Community 29 - "COP Formula Parser"
Cohesion: 0.13
Nodes (20): AST, build_variables(), _check_pow(), compile_formula(), cop_from_formula(), evaluate_formula(), _IfExpToWhere, _literal_number() (+12 more)

### Community 30 - "Stream Model"
Cohesion: 0.13
Nodes (19): BaseModel, Stream data model. Field names mirror the original Streamlit create_stream()…, Legacy property labels (prop1..prop4)., Legacy property values (val1..val4)., A single energy stream. Matches create_stream() output exactly. Both legacy…, StreamModel, StreamProperties, StreamType (+11 more)

### Community 31 - "App Shell and Routing"
Cohesion: 0.13
Nodes (16): getExample(), App(), DataCollectionPage, PotentialAnalysisPage, AppShell(), NAV_ITEMS, Props, Language (+8 more)

### Community 32 - "TS App Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 34 - "Refrigerant Limits"
Cohesion: 0.12
Nodes (20): Multi-stage heat pump levels (1/2/3) and sink medium, Refrigerant Operating Limits Table, Butane (natural refrigerant), Isobutane (natural refrigerant), Isopentane (natural refrigerant), Propane (natural refrigerant), R1224yd (synthetic refrigerant), R1233zd (synthetic refrigerant) (+12 more)

### Community 35 - "Frontend Dev Deps"
Cohesion: 0.10
Nodes (20): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, husky, jsdom (+12 more)

### Community 36 - "TS Node Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 37 - "README Overview"
Cohesion: 0.12
Nodes (19): X-API-Key Header Auth, Backend, Caddy Reverse Proxy, Docker Compose Production Stack, Environment Variables, FastAPI Backend, Features, Frontend (+11 more)

### Community 38 - "Heat Profiles"
Cohesion: 0.19
Nodes (18): build_heat_profiles(), _composite_curve(), _composite_profiles(), _curve(), _profiles_from_interval_loads(), Any, Source/sink heat profiles for heat pump integration. Three levels of heat-…, Build one composite curve using shifted temperatures. Returns (T ascending, H… (+10 more)

### Community 42 - "docs/pinch_analysis.md"
Cohesion: 0.11
Nodes (17): Construction, Deletion Algorithm, Input: Process Streams, Key results, Linnhoff & Hindmarsh (1983), Pass 1: Unfeasible Cascade (no external utility), Pass 2: Feasible Cascade, Pinch Analysis (+9 more)

### Community 43 - "puppeteer"
Cohesion: 0.11
Nodes (15): puppeteer, author, dependencies, puppeteer, description, keywords, license, main (+7 more)

### Community 44 - "Key Results (minimum utility demand, pin"
Cohesion: 0.21
Nodes (16): Key Results (minimum utility demand, pinch temperature, heat pump operating points), Linnhoff & Hindmarsh (1983) Pinch Methodology, Pinch Analysis Pipeline, Process Streams (hot/cold classification by T_S vs T_T), Temperature Shifting by ΔTmin/2, Physical Lift from Shifted GCC Temperatures, Composite Diagram (actual temperatures), Minimum Approach Temperature (dTmin) (+8 more)

### Community 45 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, axios, html2canvas, i18next, leaflet, lucide-react, pdfjs-dist, plotly.js (+9 more)

### Community 46 - "StreamEditor.tsx"
Cohesion: 0.17
Nodes (14): ALL_VARS, DEFAULT_VARS, Props, STREAM_TYPES, StreamEditor(), UNIT_OPTIONS, DEFAULT_STREAM, Props (+6 more)

### Community 47 - "Heat Recovery Modes (with / without heat"
Cohesion: 0.20
Nodes (16): Heat Recovery Modes (with / without heat recovery), Analysed Pump Selection (pickPump), Best-Available COP Selection, Carnot Fallback, COP Cap at 15.0, Heat Pump Integration (Classic Method), Heat Recovery Modes (with / no heat recovery), Integration Walk (operating point search) (+8 more)

### Community 48 - "Construction"
Cohesion: 0.12
Nodes (16): Construction, Deletion Algorithm, Input: Process Streams, Key results, Pass 1: Unfeasible Cascade (no external utility), Pass 2: Feasible Cascade, Pinch Analysis, Pipeline Summary (+8 more)

### Community 49 - "docs/heat_pump_optimization.md"
Cohesion: 0.13
Nodes (14): 1. Source-Sink Energy Balance, 2. Zero-Crossing Exact Point Detection, 2D Mesh Grid Search Algorithm, Custom COP Formula Evaluation, Heat Pump Optimization — Predictive ML Model & Grid Search, Output Summary, Predictive ML Model & Refrigerant Alternatives, Refrigerant Data Schema (+6 more)

### Community 50 - "english-stemmer.js"
Cohesion: 0.22
Nodes (8): r_R1(), r_R2(), r_shortv(), r_Step_1b(), r_Step_2(), r_Step_3(), r_Step_4(), r_Step_5()

### Community 52 - "pydata-sphinx-theme.js"
Cohesion: 0.20
Nodes (10): c(), e(), f(), g(), I(), L(), N(), p() (+2 more)

### Community 54 - "searchtools.js"
Cohesion: 0.19
Nodes (6): _displayItem(), _displayNextItem(), _escapeHTML(), _finishSearch(), Search, SearchResultKind

### Community 56 - "Heat Pump Integration — Classic Method ("
Cohesion: 0.21
Nodes (11): Heat Pump Integration — Classic Method (HTML page), Heat Pump Optimization (HTML page), HeatTransPlan — Calculation Logic (HTML index page), Pinch Analysis (HTML page), Refrigerant Operating Limits (HTML page), Geographic Stream Placement and Distance Matrix, HeatTransPlan, HeatTransPlan — Calculation Logic (+3 more)

### Community 57 - "export_cop_ranges.py"
Cohesion: 0.24
Nodes (10): build_ranges(), check_against_model(), main(), Path, Export the COP model's validity ranges to a small JSON file. The optimizer…, Warn if the ranges and the model disagree on the known categories. A…, Normalise the German dataset labels to the values the API returns., Aggregate the modelling frame into one entry per (stage, medium). (+2 more)

### Community 58 - "copybutton.js"
Cohesion: 0.27
Nodes (8): addCopyButtonToCodeCells(), escapeRegExp(), formatCopyText(), clearSelection(), codeCellId(), messages, temporarilyChangeIcon(), temporarilyChangeTooltip()

### Community 59 - "projectSchema.ts"
Cohesion: 0.18
Nodes (10): extraInfoSchema, groupCoordinatesSchema, processModelSelectionSchema, processNodeSchema, processParamsSchema, streamPropertiesSchema, streamSchema, streamTypeSchema (+2 more)

### Community 60 - "generate_report()"
Cohesion: 0.20
Nodes (10): generate_report(), get_map_preview(), post, Generate process map with drawn streams., Check a user COP formula and evaluate it at one sample point. Called as the…, Generate an HTML report and return it as a downloadable file., validate_cop_formula(), FormulaError (+2 more)

### Community 61 - "process.py"
Cohesion: 0.28
Nodes (8): ExtraInfo, ProcessModelSelection, ProcessParams, BaseModel, Process node data model. Field names mirror the original Streamlit…, Extended process metadata., Category selection from process_models.json., Process parameters for thermal power calculation.

### Community 62 - "import_csv()"
Cohesion: 0.25
Nodes (9): import_csv(), import_json(), import_json_body(), post, ProjectState, Import process data from CSV., Import a project state from a JSON file (same format as save_app_state()).…, Import a project state from JSON body (for example loading). Creates a new… (+1 more)

### Community 63 - "docs/heat_pump_integration.md"
Cohesion: 0.22
Nodes (8): At each source temperature $T$:, Convergence, Detailed Mode Breakdown, Heat Pump Integration — Classic Method, Heat Pump Technologies and Operating Windows, Integration Walk: Finding the Operating Point, Iterative sink temperature mode, Source and Sink Profiles & Heat Recovery Modes

### Community 64 - "get_project()"
Cohesion: 0.29
Nodes (7): get_project(), list_projects(), get, List all project IDs and timestamps., Get full project state by ID., list_projects(), Return dict of project_id → timestamp for all projects.

### Community 65 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, prepare, preview, test

### Community 66 - "planImage.ts"
Cohesion: 0.38
Nodes (5): fileToPlanImage(), isPdf(), pdfFirstPage(), PlanImage, pdfjs-dist

### Community 67 - "HeatTransPlan Calculation Logic (docs in"
Cohesion: 0.33
Nodes (6): HeatTransPlan Calculation Logic (docs index), Five-Stage Workflow (Data Collection to Economics), Geographic Dimension / Distance Matrix, Thermodynamic Potential, Not Design, Tutorial Slideshow (PDF), Project Import/Export (JSON, CSV)

### Community 68 - "locales.test.ts"
Cohesion: 0.33
Nodes (4): flatDe, flatEn, SAME_IN_BOTH, Tree

### Community 70 - "vite.config.ts"
Cohesion: 0.40
Nodes (3): apiProxy, vite, @vitejs/plugin-react

### Community 71 - "1 — Clone the repository"
Cohesion: 0.40
Nodes (5): 1 — Clone the repository, 2 — Start the backend, 3 — Start the frontend (separate terminal), Getting Started, Prerequisites

### Community 72 - "docker-compose backend service"
Cohesion: 0.67
Nodes (4): docker-compose backend service, docker-compose caddy reverse proxy service, docker-compose frontend service, Read-only models volume mount

### Community 73 - "sphinx-book-theme asset macros"
Cohesion: 0.50
Nodes (4): sphinx-book-theme asset macros, Bootstrap v5.3.3 (MIT), Font Awesome Free 7.2.0, pydata-sphinx-theme asset macros

### Community 76 - "sphinx_highlight.js"
Cohesion: 0.67
Nodes (3): _highlight(), _highlightText(), SphinxHighlight

### Community 77 - "lint-staged"
Cohesion: 0.50
Nodes (4): lint-staged, *.{css,md,json}, src/locales/*.json, *.{ts,tsx}

### Community 78 - "frontend/README.md"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 80 - "react-plotly.d.ts"
Cohesion: 0.50
Nodes (3): PlotProps, react-plotly.js, plotly.js

### Community 81 - "Embedded Raster Logo/Symbol Graphic"
Cohesion: 0.67
Nodes (3): Embedded Raster Logo/Symbol Graphic, Frontend HTML App Shell, Frontend React + TypeScript + Vite Setup

### Community 82 - "Sphinx File Icon (raster)"
Cohesion: 0.67
Nodes (3): Sphinx File Icon (raster), Built Search Page (Sphinx HTML output), Sphinx Docs Toolchain

### Community 86 - "docs.yml build job (sphinx-build)"
Cohesion: 0.67
Nodes (3): docs.yml build job (sphinx-build), docs.yml deploy job (github-pages environment), Deploy Sphinx Docs to GitHub Pages workflow

## Ambiguous Edges - Review These
- `Frontend HTML App Shell` → `Embedded Raster Logo/Symbol Graphic`  [AMBIGUOUS]
  backend/app/data/symbol.svg · relation: conceptually_related_to
- `Tutorial Slideshow (PDF)` → `HeatTransPlan Calculation Logic (docs index)`  [AMBIGUOUS]
  frontend/public/assets/tutorial/slideshow.pdf · relation: conceptually_related_to
- `Propane (natural refrigerant)` → `SHP and HTHPs (R717 Ammonia)`  [AMBIGUOUS]
  docs/heat_pump_integration.md · relation: conceptually_related_to

## Knowledge Gaps
- **318 isolated node(s):** `UIStore`, `StreamProperties`, `StreamValues`, `StreamInfo`, `Props` (+313 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 741 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Frontend HTML App Shell` and `Embedded Raster Logo/Symbol Graphic`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Tutorial Slideshow (PDF)` and `HeatTransPlan Calculation Logic (docs index)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Propane (natural refrigerant)` and `SHP and HTHPs (R717 Ammonia)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `de()` connect `Docs Bootstrap Vendor JS` to `i18n.ts`?**
  _High betweenness centrality (0.303) - this node is a cross-community bridge._
- **Why does `Theoretical Technology Archetypes` connect `Heat Recovery Modes (with / without heat` to `HPI Method Docs`, `Refrigerant Limits`, `HPI Optimization Config`?**
  _High betweenness centrality (0.239) - this node is a cross-community bridge._
- **Why does `Analysed Pump Selection (pickPump)` connect `Heat Recovery Modes (with / without heat` to `Economic Analysis Docs`?**
  _High betweenness centrality (0.234) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `654()` (e.g. with `dc()` and `hc()`) actually correct?**
  _`654()` has 7 INFERRED edges - model-reasoned connections that need verification._