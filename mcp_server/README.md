# HeatTransPlan MCP server

Lets an AI assistant (Claude Desktop, Claude Code, or any MCP client) do
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

```bash
pip install -e mcp_server        # or: uv tool install ./mcp_server
```

Environment:

| Variable | Default | |
|---|---|---|
| `HEATTRANSPLAN_URL` | `http://localhost:8000` | the backend |
| `HEATTRANSPLAN_API_KEY` | – | only if the backend sets `API_KEYS` |

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

Claude Code:

```bash
claude mcp add heattransplan --env HEATTRANSPLAN_URL=http://localhost:8000 -- heattransplan-mcp
```

## Tools

Projects: `list_examples`, `create_project`, `list_projects`, `get_project`,
`save_project_file`, `replace_project`, `delete_project`, `add_process`,
`update_process`, `delete_process`, `add_subprocess`, `update_subprocess`,
`delete_subprocess`, `add_stream`, `update_stream`, `delete_stream`,
`set_notes`, `set_map`, `set_site_plan`, `export_csv`, `import_csv`.

Analysis: `analyse_project`, `list_heat_pumps`, `economics_defaults`,
`economic_analysis`, `validate_cop_formula`, `generate_report`.

Live: `live_sessions`, `live_view`, `live_results`, `live_command` (every
page command; `list_commands` lists them), `live_navigate`, `live_wait`,
`live_select_streams`, `live_set_analysis`, `live_select_heat_pumps`,
`live_set_economics`, `live_save_scenario`, `live_generate_report`,
`live_load_site_plan`.

Edits follow the page's own rules: a new process comes with one subprocess,
deleting renumbers later indices and the stream selection, streams are
stored as the stream editor stores them.

## Tests

From `backend/` with the package installed in its environment:

```bash
pytest tests/test_mcp_server.py
```
