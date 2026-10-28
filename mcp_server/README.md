# HeatTransPlan MCP server

Lets any AI agent that supports MCP do
what the HeatTransPlan pages do. It talks to the HeatTransPlan backend over
HTTP, so it works with a local app and with the deployed one.

## Two ways of working

**Project files.** The AI creates a project (empty, from an example or from
a saved JSON file), adds processes, subprocesses and streams, runs the
potential analysis (pinch, heat pump integration, optimization, economics),
lists heat pumps, writes the report and saves the project file. Nothing has
to be open in a browser; open the saved file in the app to see it.

**Live, on the open page.** Click **Connect AI** in the app's header. It
shows a session code; give it to the AI. The AI then sees what the page
shows and drives it: navigate, tick streams, set ΔTmin and the heat recovery
slider, pick heat pumps on the chart, change the economics inputs, save
scenarios, make the full report (economics included), load a site plan
(PNG, JPG or PDF). The session's `project_id` works with every project tool:
edits appear on the page at once, and your own edits reach the AI.
Disconnect with the × next to the code. While connected, the project is
also stored on the server.

## Setup

**Online (nothing to install).** The backend serves this server at `/mcp`
(Streamable HTTP; `backend/app/mcp_http.py`). Add `https://<the app>/mcp` to
the agent as a remote MCP server ("connector"; in Claude: Settings →
Connectors → Add custom connector). With `API_KEYS` set on the backend the
agent sends one as `X-API-Key` or `Authorization: Bearer <key>`. Online the
tools take files as content and hand out download links; they never touch
the server's disk for a caller.

**Locally (stdio)**, to read and write files on your computer by path:

```bash
pip install -e mcp_server        # or: uv tool install --editable ./mcp_server
heattransplan-mcp
```

| Variable | Default | |
|---|---|---|
| `HEATTRANSPLAN_URL` | `http://localhost:8000` | the backend |
| `HEATTRANSPLAN_API_KEY` | – | only if the backend sets `API_KEYS` |

`explain()` reads the repository's docs/ folder (`HEATTRANSPLAN_DOCS`), or
the published docs on GitHub.

## Tools

Projects: `list_examples`, `create_project`, `get_project`,
`save_project_file`, `replace_project`, `delete_project`, `add_process`,
`update_process`, `delete_process`, `add_subprocess`, `update_subprocess`,
`delete_subprocess`, `add_stream`, `update_stream`, `delete_stream`,
`set_notes`, `set_map`, `search_address`, `set_site_plan`, `export_csv`,
`import_csv`.

The method: `explain` (what the app does, pinch, heat pump integration,
optimization, economics, refrigerants, API: the docs, without the code).

Guided study: `guide` (questions for each step: start, data, analysis,
economics, report), `read_document` (Word, PowerPoint, Excel, CSV: text and
tables), and the prompt `guided_study`.

Analysis: `analyse_project`, `list_heat_pumps`, `economics_defaults`,
`economic_analysis`, `validate_cop_formula`, `inspect_cop_data`, `train_cop_model` (when the
server runs the COP training module), `generate_report`.

Live: `live_view`, `live_results`, `live_command` (every
page command; `list_commands` lists them), `live_navigate`, `live_wait`,
`live_select_streams`, `live_set_analysis`, `live_select_heat_pumps`,
`live_filter_heat_pumps`,
`live_set_economics`, `live_use_cop_model`, `live_save_scenario`, `live_generate_report`,
`live_load_site_plan`.

Edits follow the page's own rules: a new process comes with one subprocess,
deleting renumbers later indices and the stream selection, streams are
stored as the stream editor stores them.

## Tests

From `backend/` with the package installed in its environment:

```bash
pytest tests/test_mcp_server.py
```
