# API and AI Assistants (MCP)

Everything the pages do runs through the backend's HTTP API, so other programs can use HeatTransPlan too. On top of it sits an **MCP server** (Model Context Protocol), which lets any AI assistant that supports MCP build projects, run the analysis, and watch and drive the page you have open.

---

## The HTTP API

The backend is a FastAPI application. Its interactive reference, with every endpoint, field and an in-browser "try it", is served by the backend itself:

- locally: <http://localhost:8000/api/docs>
- machine-readable: `/api/openapi.json`

**Authentication.** When the server sets `API_KEYS` (comma separated), every request needs the header `X-API-Key: <key>`. Without `API_KEYS` the API is open, which is the default for local use.

### Endpoints

**Projects** — a project is the JSON the page's Save button writes; the backend keeps projects by id.

| Method | Path | What it does |
|---|---|---|
| POST | `/api/projects` | Create a project, optionally from a project JSON |
| GET / PUT / DELETE | `/api/projects/{id}` | Read, replace or delete a project |
| POST / PUT / DELETE | `/api/projects/{id}/groups[/{g}]` | Add, rename, delete a process |
| POST | `/api/projects/{id}/groups/{g}/procs` | Add a subprocess |
| PUT / DELETE | `/api/procs/{id}/{p}` | Change or delete a subprocess |
| POST / PUT / DELETE | `/api/procs/{id}/{p}/streams`, `/api/streams/{id}/{p}/{s}` | Add, change, delete a stream |
| POST | `/api/geo/search` | Address search (OpenStreetMap Nominatim) |

**Analysis** — stateless: send the inputs, get the results.

| Method | Path | What it does |
|---|---|---|
| POST | `/api/analysis/pinch` | Pinch analysis of a list of streams |
| POST | `/api/analysis/hpi` | Heat pump integration (the prototypical technologies) |
| POST | `/api/analysis/hpi-optimization` | Heat pump optimization: every refrigerant over the source/sink grid |
| POST | `/api/analysis/cop-formula/validate` | Check a custom COP formula |
| POST | `/api/analysis/cop-model/inspect` | COP training module: columns, rows and a column guess of an uploaded table |
| POST | `/api/analysis/cop-model/train` | COP training module: train a COP network on mapped columns |
| GET | `/api/features` | Which optional modules the server runs |
| POST | `/api/analysis/project` | The Potential Analysis page's whole chain on a project: selected streams → pinch → integration → optimization → economics |
| GET | `/api/analysis/economics/defaults` | Economic inputs with their defaults, and the reference-heater presets |
| POST | `/api/analysis/economics` | Economic analysis of a heat pump (see [Economic analysis](economic_analysis.md)) |
| POST | `/api/analysis/status-quo` | Current demands against the pinch minimum |
| POST | `/api/analysis/report` | The HTML report |
| POST | `/api/analysis/map-preview` | The process map as an image |

**Import / export and assets**

| Method | Path | What it does |
|---|---|---|
| POST | `/api/io/import-json`, `/api/io/import-json-body` | Load a project file |
| GET | `/api/io/export-json/{id}`, `/api/io/export-csv/{id}`, `/api/io/export-report/{id}` | Export a project |
| POST | `/api/io/import-csv/{id}` | Load streams from CSV |
| GET | `/api/assets/examples[/{name}]` | The example projects |
| GET | `/api/assets/models` | The process model hierarchy |

**Live sessions** — see *Live control of the open page* below.

| Method | Path | What it does |
|---|---|---|
| POST | `/api/live/sessions` | Start a session for a page (sessions are never listed: the code is the key) |
| GET / DELETE | `/api/live/sessions/{sid}` | A session and what its page shows / end it |
| GET | `/api/live/sessions/{sid}/events` | The page's event stream (server-sent events) |
| PUT | `/api/live/sessions/{sid}/view` | The page reports what it shows |
| POST | `/api/live/sessions/{sid}/commands` | Run a command on the page and wait for its answer |
| POST | `/api/live/sessions/{sid}/commands/{cid}/result` | The page's answer |
| PUT | `/api/live/sessions/{sid}/pause` | The user pauses or resumes the AI |
| GET | `/api/live/pages/{code}` | The open, connected page for a code (404 none, 423 paused) |
| POST | `/api/live/pages/{code}/log` | Note what the AI changed (activity list, server log) |

### Example: analyse a project in one call

```bash
curl -s -X POST http://localhost:8000/api/analysis/project \
  -H 'Content-Type: application/json' \
  -d "{\"state\": $(curl -s http://localhost:8000/api/assets/examples/heat_integration_example_1.json),
       \"t_min\": 10, \"economics_form\": {\"pFuel\": 7}}"
```

The answer holds the streams used, the pinch result, the integration and optimization results, and the economic analysis of the best heat pump.

---

## Live control of the open page

Clicking **Connect AI** in the header connects the open page to the backend. The page then

1. keeps its project on the backend, so changes made through the project endpoints appear on the page at once, and edits made on the page reach the backend;
2. reports what it shows (page, every analysis input, key results) after each change;
3. listens for **commands** and runs each one with the same functions its own buttons, sliders and fields call, then answers.

The header shows the session code, which is what an AI needs to address the page; the × next to it ends the session. Until **Connect AI** is clicked nothing is sent: while connected, the project is also stored on the server.

```{mermaid}
sequenceDiagram
    participant AI as AI assistant (MCP)
    participant B as Backend
    participant P as Open page
    P->>B: POST /live/sessions (project)
    P->>B: GET /live/sessions/{sid}/events (stream stays open)
    AI->>B: POST /live/sessions/{sid}/commands {set_t_min: 15}
    B-->>P: event: command
    P->>P: same action as the ΔTmin field
    P->>B: POST .../commands/{cid}/result
    B-->>AI: result
    AI->>B: PUT /projects/{project_id} (an edit)
    B-->>P: event: project
```

**Commands.** `list_commands` returns the ones available at the moment; some exist only while their page is open.

| Area | Commands |
|---|---|
| Page | `navigate`, `set_language`, `set_theme`, `get_view`, `get_results`, `wait_idle` |
| Project | `get_project`, `set_project`, `set_project_notes`, `set_pinch_notes`, `set_map_view`, `load_site_plan`¹, `set_site_plan_bounds`, `remove_site_plan`, `remove_subprocess_plan`, `export_csv`, `export_distances_csv` |
| Analysis | `select_streams`, `set_t_min`, `set_show_shifted`, `set_recovery_pct`, `set_profile_mode`, `set_energy_demands`, `reset_pinch` |
| Heat pumps | `set_cop_model`, `set_cop_formula`, `set_custom_cop_model`, `set_hp_types`, `select_heat_pumps`, `reset_heat_pumps`² |
| Economics | `set_economics`, `reset_economics` |
| Scenarios | `save_scenario`, `load_scenario`, `rename_scenario`, `delete_scenario` |
| Report | `generate_report`² |

¹ while Data Collection is open · ² while Potential Analysis is open

The analyses rerun by themselves after most changes; `wait_idle` returns the view once they have finished.

---

## The MCP server

`mcp_server/` turns all of the above into tools an AI assistant can call. The backend serves it at **`/mcp`** (Streamable HTTP), so any agent that supports remote MCP servers, Claude among them, connects with the app's address alone: nothing to install.

### Setup

Add a remote MCP server of type HTTP ("streamable HTTP") with the address `<the app>/mcp`. Nothing to install, no command to run. The app's **?** next to Connect AI shows the address and these steps:

- **Claude (web, desktop, mobile):** Settings → Connectors → Add custom connector. Claude connects from Anthropic's servers, so this needs the app at a public `https://` address.
- **Claude Code:** `claude mcp add --transport http heattransplan <the app>/mcp`. Runs on your computer, so it also reaches an app at `http://localhost`.
- **Other agents:** add a remote MCP server (HTTP) with the address. Or paste this into the agent and let it set itself up: *Add the MCP server "heattransplan" with the address `<the app>/mcp` (transport: HTTP, also called streamable HTTP; no command to run, nothing to install) to your MCP settings. Then call its tool guide to check that it works.*
- **Permissions:** agents may ask before every tool. Claude Code allows them all with `/permissions` → allow `mcp__heattransplan`; other agents have a per-server setting.

If the backend sets `API_KEYS`, the agent sends one as `X-API-Key` or `Authorization: Bearer <key>`. `AI_ENABLED=0` (in `.env`) switches all of this off and hides Connect AI; the rest of the app stays as it is. Reports made by an AI say so on their first page.

Online the server never opens files on its own disk for a caller: files come in as their content (base64, or text for CSV and JSON), and what the tools write (report, project, CSV) comes back as a download link, valid for an hour. Sessions and projects are not listed: the Connect AI code is what gives access to a page, and only while it is open.

**Locally (stdio)**, for an agent on your own computer that should read and write your files by path: `pip install -e mcp_server`, then run `heattransplan-mcp` with these variables:

| Variable | Default | |
|---|---|---|
| `HEATTRANSPLAN_URL` | `http://localhost:8000` | the backend |
| `HEATTRANSPLAN_API_KEY` | – | only if the backend sets `API_KEYS` |

### Only on the open page, and under the user's control

The assistant works only on a page you have open: click **Connect AI** and give it the code. It sees what you see and works the page with you; every project tool takes the code, and its edits show up on your screen at once. Without the code, or once the page closes or you disconnect, it can only explain the method and read documents: it cannot create, change or analyse anything. Nothing it does happens out of your sight. While connected, the header shows:

- **Pause** (⏸): the assistant can do nothing, not even read, until you resume.
- **What the AI changed** (🕘): every change it made, newest first. The server logs the same.
- **Its questions:** before it deletes or replaces anything (a process, subprocess or stream, the whole project, a CSV import, a site plan, a scenario), a window asks you to allow it. Nothing happens if you refuse or do not answer.

### Security

No login, limits per visitor, browser protections, projects that leave the server, hardened containers: see [Architecture & Security](architecture_and_security.md).

### Tools

| Area | Tools |
|---|---|
| The method | `explain` (overview, pinch, heat pump integration, optimization, economics, refrigerants, api: these pages, without the code) |
| Guided study | `guide` (the questions to ask at each step: start, data, analysis, economics, report), `read_document` (text and tables of Word, PowerPoint, Excel and CSV files), the prompt `guided_study` |
| Projects | `list_examples`, `get_project`, `save_project_file`, `replace_project` (loads an example or a saved file onto the page) |
| Processes & streams | `add_process`, `update_process`, `delete_process`, `add_subprocess`, `update_subprocess`, `delete_subprocess`, `add_stream`, `update_stream`, `delete_stream`, `set_notes`, `set_map`, `search_address`, `set_site_plan`, `export_csv`, `import_csv` |
| Analysis | `analyse_project` (with today's energy demands: status quo), `list_heat_pumps`, `economics_defaults`, `economic_analysis`, `validate_cop_formula`, `inspect_cop_data`, `train_cop_model`, `generate_report` |
| Live | `live_view`, `live_results`, `live_command`, `live_navigate`, `live_wait`, `live_select_streams`, `live_set_analysis`, `live_select_heat_pumps`, `live_filter_heat_pumps`, `live_set_economics`, `live_use_cop_model`, `live_save_scenario`, `live_generate_report`, `live_load_site_plan` |

When it connects, the assistant is told what the app is for, the physics in short, how to read the results and the steps of an analysis; `explain` gives it the full method.

**Guided study.** Ask the assistant to guide you through a study (or use the `guided_study` prompt where the agent offers prompts). It goes page by page, Data Collection, Potential Analysis, Economics, Report, and asks a few questions at a time, only what your documents do not answer. Hand it Word, PowerPoint or Excel files, or paste the stream numbers. It shows the streams back as a table before entering them, and it says which values are assumptions.

Edits follow the page's rules: a new process comes with one subprocess, deleting renumbers later indices and the stream selection, and streams are stored the way the stream editor stores them. The report written from a project file covers data collection, pinch and heat pumps; the report from a connected page (`live_generate_report`) also carries the economic charts.

### Example

> *"Load example 1, analyse it with ΔTmin 15 K, and tell me which real heat pump pays back fastest at a gas price of 8 ct/kWh."*

With the page connected, the assistant calls `replace_project(code, example=…)`, `analyse_project(code, t_min=15)`, `list_heat_pumps(real_only=True)`, then `economic_analysis(inputs={"pFuel": 8}, pumps=[…])` for the candidates and compares the payback times.

<details>
<summary><b>Source code:</b> <code>mcp_server/heattransplan_mcp/server.py</code></summary>

```{literalinclude} ../mcp_server/heattransplan_mcp/server.py
:language: python
:start-at: async def analyse_project
:end-before: def _cached
```

</details>
