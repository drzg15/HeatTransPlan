# API and AI Assistants (MCP)

Everything the pages do runs through the backend's HTTP API, so other programs can use HeatTransPlan too. On top of it sits an **MCP server** (Model Context Protocol), which lets an AI assistant such as Claude build projects, run the analysis, and watch and drive the page you have open.

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
| GET | `/api/projects` | List projects (id → last change) |
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
| POST / GET | `/api/live/sessions` | Start a session for a page / list sessions |
| GET / DELETE | `/api/live/sessions/{sid}` | A session and what its page shows / end it |
| GET | `/api/live/sessions/{sid}/events` | The page's event stream (server-sent events) |
| PUT | `/api/live/sessions/{sid}/view` | The page reports what it shows |
| POST | `/api/live/sessions/{sid}/commands` | Run a command on the page and wait for its answer |
| POST | `/api/live/sessions/{sid}/commands/{cid}/result` | The page's answer |

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
| Heat pumps | `set_cop_model`, `set_cop_formula`, `set_hp_types`, `select_heat_pumps`, `reset_heat_pumps`² |
| Economics | `set_economics`, `reset_economics` |
| Scenarios | `save_scenario`, `load_scenario`, `rename_scenario`, `delete_scenario` |
| Report | `generate_report`² |

¹ while Data Collection is open · ² while Potential Analysis is open

The analyses rerun by themselves after most changes; `wait_idle` returns the view once they have finished.

---

## The MCP server

`mcp_server/` turns all of the above into tools an AI assistant can call. It talks to the backend over HTTP, so it works with a local app and with the deployed one.

### Setup

```bash
pip install -e mcp_server
```

| Variable | Default | |
|---|---|---|
| `HEATTRANSPLAN_URL` | `http://localhost:8000` | the backend |
| `HEATTRANSPLAN_API_KEY` | – | only if the backend sets `API_KEYS` |

Claude Code:

```bash
claude mcp add heattransplan --env HEATTRANSPLAN_URL=http://localhost:8000 -- heattransplan-mcp
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "heattransplan": {
      "command": "heattransplan-mcp",
      "env": { "HEATTRANSPLAN_URL": "http://localhost:8000" }
    }
  }
}
```

### Two ways of working

**Project files.** The assistant creates a project (empty, from an example or from a saved file), adds processes, subprocesses and streams, runs the analysis, compares heat pumps, runs the economic analysis with its own inputs, writes the report and saves the project file — which you then open in the app. No browser needed.

**On the open page.** Click **Connect AI** and give the assistant the code. It sees what you see and works the page with you; the session's project id works with every project tool, so its edits show up on your screen.

Both can be mixed, e.g. build a project from files, open it, connect, and have the assistant walk through the analysis on the page.

### Tools

| Area | Tools |
|---|---|
| Projects | `list_examples`, `create_project`, `list_projects`, `get_project`, `save_project_file`, `replace_project`, `delete_project` |
| Processes & streams | `add_process`, `update_process`, `delete_process`, `add_subprocess`, `update_subprocess`, `delete_subprocess`, `add_stream`, `update_stream`, `delete_stream`, `set_notes`, `set_map`, `set_site_plan`, `export_csv`, `import_csv` |
| Analysis | `analyse_project`, `list_heat_pumps`, `economics_defaults`, `economic_analysis`, `validate_cop_formula`, `generate_report` |
| Live | `live_sessions`, `live_view`, `live_results`, `live_command`, `live_navigate`, `live_wait`, `live_select_streams`, `live_set_analysis`, `live_select_heat_pumps`, `live_set_economics`, `live_save_scenario`, `live_generate_report`, `live_load_site_plan` |

Edits follow the page's rules: a new process comes with one subprocess, deleting renumbers later indices and the stream selection, and streams are stored the way the stream editor stores them. The report written from a project file covers data collection, pinch and heat pumps; the report from a connected page (`live_generate_report`) also carries the economic charts.

### Example

> *"Load example 1, analyse it with ΔTmin 15 K, and tell me which real heat pump pays back fastest at a gas price of 8 ct/kWh."*

The assistant calls `create_project(example=…)`, `analyse_project(t_min=15)`, `list_heat_pumps(real_only=True)`, then `economic_analysis(inputs={"pFuel": 8}, pumps=[…])` for the candidates and compares the payback times.

<details>
<summary><b>Source code:</b> <code>mcp_server/heattransplan_mcp/server.py</code></summary>

```{literalinclude} ../mcp_server/heattransplan_mcp/server.py
:language: python
:start-at: async def analyse_project
:end-before: def _cached
```

</details>
