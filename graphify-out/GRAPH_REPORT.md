# Graph Report - HeatTransPlan  (2026-10-29)

## Corpus Check
- 156 files · ~593,175 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2487 nodes · 5342 edges · 161 communities (99 shown, 49 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 181 edges (avg confidence: 0.89)
- Token cost: 112,101 input · 0 output

## Community Hubs (Navigation)
- Economics Formulas
- Analysis API Models
- Docs Vendor JS (FontAwesome)
- Live Client and Commands
- Stream Table and ActionBar
- MCP HTTP and Auth
- Economics Charts
- MCP Server Tools
- Optimization Config and Pinch Models
- HTML Report Rendering
- Map Selection and Connections
- Frontend IO API
- Report Request Models
- Pinch Core Solver
- Bootstrap Tooltip
- COP Formula UI
- Pinch Charts and Demands
- HPI Optimization Table
- Project Edit Operations
- Process and Stream Models
- Bootstrap Components A
- Live Router
- Bootstrap Core
- Map Rendering and Geocoding
- Bootstrap Carousel
- IO Routes and Project Service
- HP Optimization Method Docs
- Frontend Analysis API
- Live Session Service
- HP Integration Docs and Carnot
- Process REST Routes
- MCP Headless Analysis
- COP Formula Parser
- Bootstrap Utils
- Frontend Package Config
- COP Model Training
- TS App Config
- Project Analysis Chain
- MCP API Client and Errors
- Frontend Dev Dependencies
- Tutorial Images
- TS Node Config
- HeatPumpIntegration Class
- Heat Profiles
- Heat Recovery Modes Docs
- Bootstrap Config
- Bootstrap Dropdown
- Bootstrap Tabs
- Frontend Dependencies
- HPI Optimization Chart
- App Entry and Features
- Pinch Analysis Docs
- COP Data Import
- Pinch Pipeline Docs
- Bootstrap Modal
- COP Training UI
- GCC Pockets
- Problem Table Docs
- Bootstrap Collapse
- MCP Process Editing
- Rate Limiting
- Refrigerant Limits
- Docs Search Stemmer
- Bootstrap Scrollbar
- Sphinx Theme JS
- Guided Tour
- Golden Tests
- Bootstrap Popover
- Bootstrap jQuery Bridge
- Bootstrap ScrollSpy
- Docs Search
- Stream REST Routes
- Live Session Tests
- Document Reader
- Heat Pump Validation
- Project REST Routes
- Docs Index
- Bootstrap Swipe
- Economics Method Docs
- Project Schema
- MCP Confirmed Deletes
- MCP HTTP Client
- COP Ranges Export
- API and Retention Docs
- Docs Copy Button
- Bootstrap Offcanvas
- Docs Sources and Citations
- AI Safety Docs
- README Overview
- Partial Plotly Bundle
- Docker and Dependabot
- COP Training Router
- Docs Vendor Misc
- Bootstrap Focus Trap
- COP Model Docs
- Frontend Scripts
- Site Plan Images
- Session Disconnect
- VDI 4646 Costs
- Locale Tests
- HPI Plot (matplotlib)
- TSP Plot (matplotlib)
- Temperature Pocket Deletion
- Live Session Docs
- Vite Config
- API Tests
- Docs Vendor Licenses
- HP Integration Walk Docs
- Docs Copy Funcs
- Sphinx Doctools
- Sphinx Highlight
- Lint-staged Config
- Frontend README
- Error Boundary
- Frontend Shell Assets
- Sphinx Search Page
- TS Root Config
- Docs Deploy Workflow
- Sphinx Icons
- Refrigerant Docs Source
- Sphinx Options
- Vite/React Logos
- Test Setup
- get
- ValueError
- post
- get
- post
- ProjectState
- post
- get
- post
- Path
- ProjectState
- Any
- Tabler Check Icon (copybutton success)
- Tabler Copy Icon (copybutton)
- Binder Launch Button Logo
- Google Colab Launch Button Logo
- Deepnote Launch Button Logo
- JupyterHub Launch Button Logo
- JupyterLite Logo (docs in-browser notebo
- Rendered general index page
- Exception
- fixture
- heattransplan-backend
- heattransplan-mcp
- UploadFile

## God Nodes (most connected - your core abstractions)
1. `654()` - 55 edges
2. `tool()` - 46 edges
3. `react` - 43 edges
4. `ps` - 40 edges
5. `useAnalysisStore` - 39 edges
6. `react-i18next` - 37 edges
7. `ci` - 29 edges
8. `trigger()` - 27 edges
9. `useProjectStore` - 27 edges
10. `OptimizedIntegrationPoint` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Embedded Raster Logo/Symbol Graphic` --conceptually_related_to--> `Frontend HTML App Shell`  [AMBIGUOUS]
  backend/app/data/symbol.svg → frontend/index.html
- `Pinch Analysis Pipeline` --references--> `PinchMain`  [EXTRACTED]
  docs/_build/html/_sources/pinch_analysis.md → backend/app/modules/pinch_main.py
- `Carnot Fallback` --references--> `carnot_cop()`  [EXTRACTED]
  docs/heat_pump_integration.md → backend/app/modules/heat_pump_integration/heat_pump_integration.py
- `Custom COP Formula Evaluation (safe AST)` --references--> `compile_formula()`  [EXTRACTED]
  docs/_build/html/_sources/heat_pump_optimization.md → backend/app/utils/cop_formula.py
- `Heat Recovery Modes (with / without heat recovery)` --references--> `resolve_profiles()`  [EXTRACTED]
  docs/_build/html/_sources/heat_pump_integration.md → backend/app/modules/utility/heat_profiles.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Heat Pump Technology Archetypes** — docs_heat_pump_integration_prototypical_stirling, docs_build_html_sources_heat_pump_integration_vhthp_hfc_hfo, docs_heat_pump_integration_shp_hthps_hfc_hfo, docs_heat_pump_integration_shp_hthps_r717, docs_build_html_sources_heat_pump_integration_carnot_fallback [EXTRACTED 1.00]
- **HeatTransPlan Seven-Step Onboarding Walkthrough** — frontend_public_tutorial_step0_overview_getting_started, frontend_public_tutorial_step1_process_subprocess_stream_editor, frontend_public_tutorial_step2_geolocation, frontend_public_tutorial_step3_add_subprocess_data, frontend_public_tutorial_step4_stream_summary_selection, frontend_public_tutorial_step5_composite_curves, frontend_public_tutorial_step6_heat_pump_integration [EXTRACTED 1.00]
- **Pinch Analysis Pipeline (shift -> intervals -> problem table -> cascade -> curves -> pocket deletion)** — docs_pinch_analysis_temperature_shifting, docs_pinch_analysis_temperature_intervals, docs_pinch_analysis_problem_table, docs_pinch_analysis_heat_cascade, docs_pinch_analysis_grand_composite_curve, docs_pinch_analysis_temperature_pocket_deletion, docs_heat_pump_integration_heat_pump_integration [EXTRACTED 1.00]
- **Pinch Analysis Pipeline Steps** — docs_build_html_sources_pinch_analysis_temperature_shifting, docs_pinch_analysis_temperature_intervals, docs_pinch_analysis_problem_table, docs_pinch_analysis_heat_cascade, docs_pinch_analysis_shifted_composite_diagram, docs_pinch_analysis_composite_diagram, docs_pinch_analysis_grand_composite_curve, docs_pinch_analysis_temperature_pocket_deletion [EXTRACTED 1.00]
- **Heat Pump Optimization Grid Search Flow** — docs_build_html_sources_heat_pump_optimization_mesh_grid_search, docs_build_html_sources_heat_pump_optimization_source_sink_energy_balance, docs_heat_pump_optimization_zero_crossing_detection, docs_build_html_sources_heat_pump_optimization_source_limited_heat_pump_integration, docs_heat_pump_optimization_demand_limited, docs_heat_pump_optimization_max_duty_tiebreak [INFERRED 0.85]
- **Pinch Analysis to Heat Pump Sizing Computation Chain** — frontend_public_tutorial_step4_current_energy_supply, frontend_public_tutorial_step5_pinch_analysis_kpis, frontend_public_tutorial_step6_net_load_curves_default, frontend_public_tutorial_step6_integrable_heat_pumps_table, frontend_public_tutorial_step4_status_quo_vs_proposal [INFERRED 0.85]
- **AI Agent Safety Controls on Connected Page** — docs_architecture_and_security_page_info_check, docs_architecture_and_security_confirm, docs_architecture_and_security_read_input_deliver, docs_api_and_mcp_user_control, docs_architecture_and_security_ai_rules [EXTRACTED 1.00]
- **Economic NPV Calculation Chain** — docs_economic_analysis_fuel_price, docs_economic_analysis_el_price, docs_economic_analysis_flows, docs_economic_analysis_evaluate, docs_economic_analysis_break_even_el_price, docs_economic_analysis_net_present_value [INFERRED 0.85]
- **COP Sources Swept Through the Optimization Mesh** — docs_heat_pump_optimization_cop_ml_model, docs_heat_pump_optimization_technology_archetypes, docs_heat_pump_optimization_cop_training_module, docs_heat_pump_optimization_compile_formula, docs_heat_pump_optimization_run_hpi_optimization [EXTRACTED 1.00]

## Communities (161 total, 49 thin omitted)

### Community 0 - "Economics Formulas"
Cohesion: 0.07
Nodes (76): allocation_factor(), annuity_factor(), break_even_el_price(), _co2_at(), EconInputs, EconReference, EconVariant, el_price() (+68 more)

### Community 1 - "Analysis API Models"
Cohesion: 0.05
Nodes (71): CompositeDiagramData, CopFormulaSpec, CopFormulaValidateRequest, CopFormulaValidateResult, EnergyDemand, HeatPumpEntry, HPIntegrationResult, HPIOptimizationRequest (+63 more)

### Community 2 - "Docs Vendor JS (FontAwesome)"
Cohesion: 0.06
Nodes (55): d(), e(), h(), i(), m(), r(), v(), q() (+47 more)

### Community 3 - "Live Client and Commands"
Cohesion: 0.07
Nodes (48): API_BASE, API_KEY, planBoundsInView(), PlanControls(), AiControls(), Ask, analysis(), Args (+40 more)

### Community 4 - "Stream Table and ActionBar"
Cohesion: 0.07
Nodes (44): Props, SortKey, StreamDataTable(), ActionBar(), BASE_OPTIONS, Props, GroupCoords, ProcessGroupList() (+36 more)

### Community 5 - "MCP HTTP and Auth"
Cohesion: 0.06
Nodes (48): _base_url(), download(), lifespan(), McpEndpoint, The MCP server online: the backend serves it at /mcp, so an agent (Claude or…, The address the caller used, through Caddy or Vite's proxy., ASGI app at /mcp: checks the key, notes the public address, hands over., Run the MCP session manager and point the tools at this app. (+40 more)

### Community 6 - "Economics Charts"
Cohesion: 0.08
Nodes (49): ChartCtx, chartTheme(), COLORS, Fig, investmentChart(), npvChart(), priceChart(), sensitivityChart() (+41 more)

### Community 7 - "MCP Server Tools"
Cohesion: 0.06
Nodes (54): _deliver(), download(), economics_defaults(), explain(), export_csv(), guide(), guided_study(), list_examples() (+46 more)

### Community 8 - "Optimization Config and Pinch Models"
Cohesion: 0.07
Nodes (44): Locate an asset regardless of where the server was started from. Compose mounts…, _resolve(), HPIOptimizationDiagnostics, PinchResult, PinchStream, Why the optimization found little or nothing. Filled on every run, so an empty…, A single stream for pinch analysis input., Full output of pinch analysis. (+36 more)

### Community 9 - "HTML Report Rendering"
Cohesion: 0.10
Nodes (41): The whole report: data collection page, scenario pages, comparison page., Any, The economic analysis section of a scenario page., _render_economics(), _card(), _chart(), _optimization_figure(), Any (+33 more)

### Community 10 - "Map Selection and Connections"
Cohesion: 0.09
Nodes (33): BoxSelector(), ConnectionLines(), boxHalf(), Half, Pt, routeConnection(), box, MapCenterSync() (+25 more)

### Community 11 - "Frontend IO API"
Cohesion: 0.08
Nodes (25): client, getExample(), App(), DataCollectionPage, PotentialAnalysisPage, AppShell(), NAV_ITEMS, Props (+17 more)

### Community 12 - "Report Request Models"
Cohesion: 0.10
Nodes (38): HPIOptimizationResult, OptimizedIntegrationPoint, BaseModel, Report request/response models., Stream data for report generation., Current energy demand entry., Subprocess data for the data-collection table., Data for a single scenario in the report. (+30 more)

### Community 13 - "Pinch Core Solver"
Cohesion: 0.08
Nodes (5): PinchMain, PinchExport, Pinch, PinchPlot, Streams

### Community 15 - "COP Formula UI"
Cohesion: 0.08
Nodes (31): validateCopFormula(), BUILTIN_FORMULAS, DEFAULT_COP_FORMULA, Props, Props, HPIOptimizationFilters(), MultiSelect(), Props (+23 more)

### Community 16 - "Pinch Charts and Demands"
Cohesion: 0.11
Nodes (28): CopCoverageChart(), EnergyDemands(), HeatRecoveryToggle(), LABEL_INK, LINKED, PinchCurvesChart(), LINKED, PinchMetrics() (+20 more)

### Community 17 - "HPI Optimization Table"
Cohesion: 0.09
Nodes (27): features, inspect, train, trained, HPIOptimizationPanel(), result, beats(), chartView() (+19 more)

### Community 18 - "Project Edit Operations"
Cohesion: 0.10
Nodes (36): add_process(), add_stream(), add_subprocess(), _check_process(), _check_subprocess(), delete_process(), delete_stream(), delete_subprocess() (+28 more)

### Community 19 - "Process and Stream Models"
Cohesion: 0.11
Nodes (29): ExtraInfo, ProcessModelSelection, ProcessNode, ProcessParams, BaseModel, Process node data model. Field names mirror the original Streamlit…, Extended process metadata., Category selection from process_models.json. (+21 more)

### Community 21 - "Live Router"
Cohesion: 0.11
Nodes (30): economics_defaults(), Default inputs of the economic analysis and the reference-heater presets., Command, CommandResult, connected_page(), get_session(), log_ai_action(), LogEntry (+22 more)

### Community 22 - "Bootstrap Core"
Cohesion: 0.09
Nodes (13): ae(), ce(), de(), G(), gt(), he(), I(), le() (+5 more)

### Community 23 - "Map Rendering and Geocoding"
Cohesion: 0.11
Nodes (26): generate_process_map_b64(), Map rendering service. Generates images with process boxes and stream circles…, Generate a base64 encoded PNG image of the map with processes and streams…, geocode_address(), haversine_distance(), lonlat_to_tile_xy(), Geo utilities — extracted from data_collection.py. Web Mercator projection +…, Convert lon/lat to tile x/y at given zoom level. (+18 more)

### Community 24 - "Bootstrap Carousel"
Cohesion: 0.15
Nodes (3): ci, on(), one()

### Community 25 - "IO Routes and Project Service"
Cohesion: 0.11
Nodes (26): export_csv(), export_json(), import_csv(), import_json(), import_json_body(), UploadFile, I/O router — import/export JSON state, CSV, and HTML report., Import process data from CSV. (+18 more)

### Community 26 - "HP Optimization Method Docs"
Cohesion: 0.12
Nodes (27): Condenser Duty Energy Balance (Q_ko = Q_ev / (1 - 1/COP)), 1. Source-Sink Energy Balance, 2. Zero-Crossing Exact Point Detection, 2D Mesh Grid Search Algorithm, cop_ranges.json Refrigerant Alternatives Database, Custom COP Formula Evaluation (safe AST), Custom COP Formula Evaluation, Heat Pump Optimization — Predictive ML Model & Grid Search (+19 more)

### Community 27 - "Frontend Analysis API"
Cohesion: 0.14
Nodes (18): generateReport(), runEconomics(), runHPI(), runHPIOptimization(), runPinch(), runStatusQuo(), ScenarioComparison(), MapViewer() (+10 more)

### Community 28 - "Live Session Service"
Cohesion: 0.13
Nodes (24): connected_session(), create(), events(), notify_project(), _prune(), _publish(), Any, Exception (+16 more)

### Community 29 - "HP Integration Docs and Carnot"
Cohesion: 0.16
Nodes (24): carnot_cop(), in_operating_window(), Carnot COP at 50 % efficiency — the generic fallback for 'any heat pump'. This…, True when `hp_type` is rated for this sink temperature and lift., Best-Available COP Selection, Carnot Fallback, COP Cap of 15.0, Prototypical Heat Pump COP Regression (+16 more)

### Community 30 - "Process REST Routes"
Cohesion: 0.13
Nodes (25): add_child(), add_group(), add_subprocess(), delete_child(), delete_group(), delete_subprocess(), geo_search(), GeoQuery (+17 more)

### Community 31 - "MCP Headless Analysis"
Cohesion: 0.14
Nodes (26): analyse_project(), _cached(), _econ_summary(), economic_analysis(), generate_report(), get_project(), import_csv(), _keep() (+18 more)

### Community 32 - "COP Formula Parser"
Cohesion: 0.13
Nodes (22): AST, build_variables(), _check_pow(), compile_formula(), cop_from_formula(), evaluate_formula(), FormulaError, _IfExpToWhere (+14 more)

### Community 33 - "Bootstrap Utils"
Cohesion: 0.24
Nodes (24): ct(), D(), dt(), et(), F(), ft(), H(), ht() (+16 more)

### Community 34 - "Frontend Package Config"
Cohesion: 0.10
Nodes (22): name, private, type, version, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+14 more)

### Community 35 - "COP Model Training"
Cohesion: 0.13
Nodes (21): alternatives(), describe(), _design(), _fit_nn(), _fit_regression(), _formula(), _num(), _prepare() (+13 more)

### Community 36 - "TS App Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 37 - "Project Analysis Chain"
Cohesion: 0.17
Nodes (18): analyse_project(), _cp(), _cp_direct(), _js_truthy(), _mdot(), Any, The Potential Analysis page's chain on a stored project: read the selected…, The streams the analysis runs on, named and valued as the page does. (+10 more)

### Community 38 - "MCP API Client and Errors"
Cohesion: 0.11
Nodes (20): ApiError, The HeatTransPlan backend over HTTP. Errors come back as readable text, which…, A failure the AI should read: its text reaches the model., read(), inspect_cop_data(), _page_info(), Note a change in the page's AI activity list (and the server's log)., The page that is open and connected, by its Connect AI code or project id: its… (+12 more)

### Community 39 - "Frontend Dev Dependencies"
Cohesion: 0.10
Nodes (20): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, husky, jsdom (+12 more)

### Community 40 - "Tutorial Images"
Cohesion: 0.11
Nodes (20): HeatTransPlan Favicon (gradient heat-flow arrow: blue to fuchsia to red), Cold-to-Hot Blue/Red Color Encoding, HeatTransPlan Two-Phase Workflow (Data Collection then Potential Analysis), Tutorial Step 0: Overview & Getting Started (Home Page), Process / Subprocess / Stream Data Hierarchy, Map Stream Bubble Legend (red=hot, blue=cold, radius=Q in kW), Tutorial Step 1: Process/Subprocess/Stream Editor with Map, Stream Property Chip Selector (Tin, Tout, mdot, cp, CP, Water Content, Density, Pressure) (+12 more)

### Community 41 - "TS Node Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 42 - "HeatPumpIntegration Class"
Cohesion: 0.18
Nodes (6): HeatPumpIntegration, A heat pump needs a positive temperature lift. With the pocket-free GCC the…, Best COP available at source temperature T, across every technology rated for…, Returns list of all heat pump types with their COPs and availability status, Select the operating point to report from the walk in table_issp. If the very…, Same as integrate_heat_pump but pinned to one named technology. Propagates…

### Community 43 - "Heat Profiles"
Cohesion: 0.19
Nodes (18): build_heat_profiles(), _composite_curve(), _composite_profiles(), _curve(), _profiles_from_interval_loads(), Any, Source/sink heat profiles for heat pump integration. Three levels of heat-…, Build one composite curve using shifted temperatures. Returns (T ascending, H… (+10 more)

### Community 44 - "Heat Recovery Modes Docs"
Cohesion: 0.15
Nodes (18): Heat Recovery Modes (with / without heat recovery), At each source temperature $T$:, Best-Available COP Selection, Carnot Fallback, Convergence, COP Cap at 15.0, Detailed Mode Breakdown, Heat Pump Integration (Classic Method) (+10 more)

### Community 45 - "Bootstrap Config"
Cohesion: 0.14
Nodes (3): ge(), getDataAttributes(), ve

### Community 48 - "Frontend Dependencies"
Cohesion: 0.11
Nodes (19): dependencies, axios, driver.js, html2canvas, i18next, leaflet, leaflet-rotate, lucide-react (+11 more)

### Community 49 - "HPI Optimization Chart"
Cohesion: 0.21
Nodes (14): HPIOptimizationChart(), Props, opt, plots, HPIOptimizationChartHelp(), heatPumpSchematic(), SchematicColors, activePointsOf() (+6 more)

### Community 50 - "App Entry and Features"
Cohesion: 0.13
Nodes (14): features(), health(), Which optional modules this server runs, so the page shows only those., serve_frontend(), get_example(), get_process_models(), list_examples(), get (+6 more)

### Community 51 - "Pinch Analysis Docs"
Cohesion: 0.11
Nodes (17): Construction, Deletion Algorithm, Input: Process Streams, Key results, Linnhoff & Hindmarsh (1983), Pass 1: Unfeasible Cascade (no external utility), Pass 2: Feasible Cascade, Pinch Analysis (+9 more)

### Community 52 - "COP Data Import"
Cohesion: 0.19
Nodes (16): inspect_data(), The uploaded table's columns, row count, a preview, and a first guess of which…, DataError, default_sheet(), guess_mapping(), inspect(), _numeric(), Any (+8 more)

### Community 53 - "Pinch Pipeline Docs"
Cohesion: 0.21
Nodes (16): Key Results (minimum utility demand, pinch temperature, heat pump operating points), Linnhoff & Hindmarsh (1983) Pinch Methodology, Pinch Analysis Pipeline, Process Streams (hot/cold classification by T_S vs T_T), Temperature Shifting by ΔTmin/2, Physical Lift from Shifted GCC Temperatures, Pinch Temperature, Composite Diagram (actual temperatures) (+8 more)

### Community 54 - "Bootstrap Modal"
Cohesion: 0.21
Nodes (3): remove(), Sn, trigger()

### Community 55 - "COP Training UI"
Cohesion: 0.24
Nodes (14): inspectCopData(), trainCopModel(), capped(), CopModelTrainModal(), errorText(), OPTIONAL, RANGE_KEYS, REQUIRED (+6 more)

### Community 56 - "GCC Pockets"
Cohesion: 0.21
Nodes (9): gccPockets(), Pockets, side(), HPISummary(), PinchSummary(), sameKey(), summaryPoints(), formatDe() (+1 more)

### Community 57 - "Problem Table Docs"
Cohesion: 0.12
Nodes (16): Construction, Deletion Algorithm, Input: Process Streams, Key results, Pass 1: Unfeasible Cascade (no external utility), Pass 2: Feasible Cascade, Pinch Analysis, Pipeline Summary (+8 more)

### Community 59 - "MCP Process Editing"
Cohesion: 0.12
Nodes (16): add_process(), add_subprocess(), _edit(), Load, change, save; returns the change's result and the new overview., Add a process (a box on the map) with one empty subprocess, as the "Add…, Rename a process or set its position (lat/lon), operating hours or box size., Add a subprocess (where streams live) to a process. Returns its index., Set a subprocess's name, position, operating hours, following subprocess(es)… (+8 more)

### Community 60 - "Rate Limiting"
Cohesion: 0.23
Nodes (9): RateLimit, Requests per visitor (IP address) and minute, so nobody can flood the server or…, Seconds to wait when key has used its limit, else 0., _too_many(), _app(), _call(), Requests per visitor: a flood or a run of guessed codes gets 429, other…, test_a_visitor_over_the_limit_waits_others_do_not() (+1 more)

### Community 61 - "Refrigerant Limits"
Cohesion: 0.14
Nodes (14): Multi-stage heat pump levels (1/2/3) and sink medium, Refrigerant Operating Limits Table, Butane (natural refrigerant), Isobutane (natural refrigerant), Isopentane (natural refrigerant), Propane (natural refrigerant), R1224yd (synthetic refrigerant), R1233zd (synthetic refrigerant) (+6 more)

### Community 62 - "Docs Search Stemmer"
Cohesion: 0.22
Nodes (8): r_R1(), r_R2(), r_shortv(), r_Step_1b(), r_Step_2(), r_Step_3(), r_Step_4(), r_Step_5()

### Community 63 - "Bootstrap Scrollbar"
Cohesion: 0.25
Nodes (4): _e(), fn, removeDataAttribute(), setDataAttribute()

### Community 64 - "Sphinx Theme JS"
Cohesion: 0.20
Nodes (10): c(), e(), f(), g(), I(), L(), N(), p() (+2 more)

### Community 65 - "Guided Tour"
Cohesion: 0.21
Nodes (13): CHAPTERS, makeBar(), PART, PARTS, startTour(), end(), go(), target() (+5 more)

### Community 66 - "Golden Tests"
Cohesion: 0.24
Nodes (13): _check(), _example(), _isolated_state(), _normalize(), _pinch_streams(), fixture, parametrize, Golden snapshot of every API endpoint, taken before the refactoring. Each case… (+5 more)

### Community 70 - "Docs Search"
Cohesion: 0.19
Nodes (6): _displayItem(), _displayNextItem(), _escapeHTML(), _finishSearch(), Search, SearchResultKind

### Community 71 - "Stream REST Routes"
Cohesion: 0.17
Nodes (11): add_child_stream(), add_stream(), delete_stream(), delete, post, put, Streams router — CRUD for streams on any process node., Add a stream to a subprocess. (+3 more)

### Community 72 - "Live Session Tests"
Cohesion: 0.15
Nodes (8): _isolated(), fixture, Live sessions: a page subscribes, the AI edits the project and runs commands,…, AI_ENABLED=0: no Connect AI, no live endpoints, no /mcp; projects still work., Disconnecting deletes the page's project; any other project goes once nobody…, test_ai_switched_off_leaves_the_rest(), test_pausing_stops_the_ai_and_the_log_reaches_the_page(), test_projects_do_not_stay_on_the_server()

### Community 73 - "Document Reader"
Cohesion: 0.35
Nodes (12): Element, _blocks(), _col(), _docx(), _name(), _pptx(), Any, Text and tables out of the documents a user hands over (Word, PowerPoint,… (+4 more)

### Community 74 - "Heat Pump Validation"
Cohesion: 0.20
Nodes (6): HeatPumpOutOfRange, COP of one named technology at source temperature T. Raises HeatPumpOutOfRange…, A named heat pump technology was asked for a duty outside its rating. Raised…, field_validator, model_validator, ValueError

### Community 75 - "Project REST Routes"
Cohesion: 0.17
Nodes (10): create_project(), delete_project(), get_project(), delete, put, Projects router — CRUD for project state., Create a new project, optionally initialized with state., Get full project state by ID. (+2 more)

### Community 76 - "Docs Index"
Cohesion: 0.21
Nodes (11): Heat Pump Integration — Classic Method (HTML page), Heat Pump Optimization (HTML page), HeatTransPlan — Calculation Logic (HTML index page), Pinch Analysis (HTML page), Refrigerant Operating Limits (HTML page), Geographic Stream Placement and Distance Matrix, HeatTransPlan, HeatTransPlan — Calculation Logic (+3 more)

### Community 78 - "Economics Method Docs"
Cohesion: 0.18
Nodes (12): Break-even Electricity Price (break_even_el_price), Gross vs Net Calorific Value (Hs/Hi) Correction, Dynamic Payback, el_price, evaluate, _flows (operating costs per year), fuel_price, Net Present Value Method (Kapitalwertmethode) (+4 more)

### Community 79 - "Project Schema"
Cohesion: 0.17
Nodes (11): extraInfoSchema, groupCoordinatesSchema, processModelSelectionSchema, processNodeSchema, processParamsSchema, projectStateSchema, streamPropertiesSchema, streamSchema (+3 more)

### Community 80 - "MCP Confirmed Deletes"
Cohesion: 0.20
Nodes (12): _confirm(), delete_process(), delete_stream(), delete_subprocess(), _label(), live_command(), Run any page command; "list_commands" lists those available now (some exist…, Ask the user on the page before a change that cannot simply be redone… (+4 more)

### Community 81 - "MCP HTTP Client"
Cohesion: 0.33
Nodes (5): AsyncClient, Api, Any, Point the tools at another backend (tests)., set_api()

### Community 82 - "COP Ranges Export"
Cohesion: 0.24
Nodes (10): build_ranges(), check_against_model(), main(), Path, Export the COP model's validity ranges to a small JSON file. The optimizer…, Warn if the ranges and the model disagree on the known categories. A…, Normalise the German dataset labels to the values the API returns., Aggregate the modelling frame into one entry per (stage, medium). (+2 more)

### Community 83 - "API and Retention Docs"
Cohesion: 0.22
Nodes (11): analyse_project (MCP tool), POST /api/analysis/project (full analysis chain), X-API-Key Authentication (API_KEYS), HeatTransPlan HTTP API (FastAPI), Project Data Retention (deleted at Disconnect or after 24h), _read_input / _deliver (no server files), compile_formula (safe AST custom COP formula), COP Training Module (Train from my data) (+3 more)

### Community 84 - "Docs Copy Button"
Cohesion: 0.27
Nodes (8): addCopyButtonToCodeCells(), escapeRegExp(), formatCopyText(), clearSelection(), codeCellId(), messages, temporarilyChangeIcon(), temporarilyChangeTooltip()

### Community 86 - "Docs Sources and Citations"
Cohesion: 0.31
Nodes (10): API and AI Assistants (MCP) doc, Architecture & Security doc, Economic Analysis doc, Hipp 2026 Industrial Feasibility Study, Hitzkoepfe Academy Seminar ch. 7, Economic Validation (VDI examples, Hipp study), VDI 2067 Blatt 1:2012-09, HeatTransPlan Calculation Logic (docs index) (+2 more)

### Community 87 - "AI Safety Docs"
Cohesion: 0.29
Nodes (10): Guided Study (guide, read_document, guided_study prompt), HeatTransPlan MCP Server (Streamable HTTP at /mcp), Only on the Open Page, Under User Control (pause, activity log, confirmations), What the AI May Do (rules and enforcement), _confirm (confirm_ai_action), _page_info connected-page check, HeatTransPlan MCP server README, explain tool (reads docs/ via HEATTRANSPLAN_DOCS) (+2 more)

### Community 88 - "README Overview"
Cohesion: 0.22
Nodes (10): econReportData (shared econ module), _calculation_details (COP provenance), Theoretical Technology Archetypes (Stirling, VHTHP, SHP/HTHP, 50% Carnot), _theoretical_alternatives, Heat Pump Integration Feature, HeatTransPlan Web Application, HTML Report Export, Scenario Comparison (+2 more)

### Community 89 - "Partial Plotly Bundle"
Cohesion: 0.20
Nodes (8): plotly.js/lib/bar, plotly.js/lib/core, plotly.js/lib/heatmap, PlotProps, react-plotly.js, react-plotly.js/factory, plotly.js, react-plotly.js

### Community 90 - "Docker and Dependabot"
Cohesion: 0.39
Nodes (7): Weekly Dependabot Updates (pip, npm, docker, github-actions), backend service (container), Caddy reverse proxy service, Container Hardening (read_only, cap_drop ALL, no-new-privileges), docs service (container), frontend service (container), Security Layers (no login, each layer holds on its own)

### Community 91 - "COP Training Router"
Cohesion: 0.25
Nodes (7): ColumnMapping, Which column of the uploaded table holds what., UploadFile, COP training router — upload heat pump data, map its columns, train a COP…, Train a COP model on the mapped columns: a neural network ("nn"), a polynomial…, train_model(), COP training: fit a neural network to the user's own heat pump data and use it…

### Community 92 - "Docs Vendor Misc"
Cohesion: 0.25
Nodes (7): B(), kt(), lt(), Ot(), s(), yt(), o()

### Community 94 - "COP Model Docs"
Cohesion: 0.29
Nodes (7): Heat Pump Optimization doc, COP Neural Network Models (MLPRegressor 128-64, 4T and 2T), cop_ranges.json Refrigerant Alternatives, _four_temperature_alternatives, _load_model_and_data, _model_cop_fn, Temperature Approach Corrections (dT_evap, dT_cond)

### Community 95 - "Frontend Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, prepare, preview, test

### Community 96 - "Site Plan Images"
Cohesion: 0.38
Nodes (5): fileToPlanImage(), isPdf(), pdfFirstPage(), PlanImage, pdfjs-dist

### Community 97 - "Session Disconnect"
Cohesion: 0.33
Nodes (6): delete_session(), delete, Disconnect: the session ends and its project leaves the server (the page keeps…, project_ids(), The projects open sessions use., remove()

### Community 98 - "VDI 4646 Costs"
Cohesion: 0.33
Nodes (6): Allocation Factor (Finnish method), Danish Energy Agency Technology Data - Industrial Process Heat (2026), Heat Pump Investment (flat 1000 EUR/kW x F_PI x F_Per), VDI 4646:2026-05, VDI 4646 Results (LCOH, static payback, IRR), vdi_specific_cost (VDI cost function)

### Community 99 - "Locale Tests"
Cohesion: 0.33
Nodes (4): flatDe, flatEn, SAME_IN_BOTH, Tree

### Community 103 - "Live Session Docs"
Cohesion: 0.60
Nodes (5): Live Sessions / Connect AI, Page Commands (navigate, set_t_min, select_heat_pumps, ...), Single-Process In-Memory State Limitation, Requests-per-Visitor Rate Limit (rate_limit.py), Live MCP Tools (live_view, live_command, live_select_heat_pumps, ...)

### Community 104 - "Vite Config"
Cohesion: 0.40
Nodes (3): apiProxy, vite, @vitejs/plugin-react

### Community 106 - "Docs Vendor Licenses"
Cohesion: 0.50
Nodes (4): sphinx-book-theme asset macros, Bootstrap v5.3.3 (MIT), Font Awesome Free 7.2.0, pydata-sphinx-theme asset macros

### Community 107 - "HP Integration Walk Docs"
Cohesion: 0.50
Nodes (4): At each source temperature $T$:, Convergence, Integration Walk: Finding the Operating Point, Iterative Sink Temperature Mode

### Community 110 - "Sphinx Highlight"
Cohesion: 0.67
Nodes (3): _highlight(), _highlightText(), SphinxHighlight

### Community 111 - "Lint-staged Config"
Cohesion: 0.50
Nodes (4): lint-staged, *.{css,md,json}, src/locales/*.json, *.{ts,tsx}

### Community 112 - "Frontend README"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 114 - "Frontend Shell Assets"
Cohesion: 0.67
Nodes (3): Embedded Raster Logo/Symbol Graphic, Frontend HTML App Shell, Frontend React + TypeScript + Vite Setup

### Community 115 - "Sphinx Search Page"
Cohesion: 0.67
Nodes (3): Sphinx File Icon (raster), Built Search Page (Sphinx HTML output), Sphinx Docs Toolchain

### Community 117 - "Docs Deploy Workflow"
Cohesion: 0.67
Nodes (3): docs.yml build job (sphinx-build), docs.yml deploy job (github-pages environment), Deploy Sphinx Docs to GitHub Pages workflow

## Ambiguous Edges - Review These
- `Frontend HTML App Shell` → `Embedded Raster Logo/Symbol Graphic`  [AMBIGUOUS]
  backend/app/data/symbol.svg · relation: conceptually_related_to
- `SHP and HTHPs (R717 Ammonia)` → `Propane (natural refrigerant)`  [AMBIGUOUS]
  docs/heat_pump_integration.md · relation: conceptually_related_to

## Knowledge Gaps
- **325 isolated node(s):** `UIStore`, `Pockets`, `LinkStream`, `PinchLinkStore`, `Props` (+320 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 944 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Frontend HTML App Shell` and `Embedded Raster Logo/Symbol Graphic`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `SHP and HTHPs (R717 Ammonia)` and `Propane (natural refrigerant)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `ProjectState` connect `Live Client and Commands` to `IO Routes and Project Service`, `Frontend IO API`, `Stream Table and ActionBar`?**
  _High betweenness centrality (0.374) - this node is a cross-community bridge._
- **Why does `de()` connect `Bootstrap Core` to `HPI Optimization Table`?**
  _High betweenness centrality (0.242) - this node is a cross-community bridge._
- **Why does `get_project()` connect `IO Routes and Project Service` to `Live Client and Commands`, `Project REST Routes`, `Process REST Routes`, `Stream REST Routes`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `654()` (e.g. with `dc()` and `hc()`) actually correct?**
  _`654()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `UIStore`, `Pockets`, `LinkStream` to the rest of the system?**
  _325 weakly-connected nodes found - possible documentation gaps or missing edges._