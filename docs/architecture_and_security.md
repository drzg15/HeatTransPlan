# Architecture & Security

How HeatTransPlan is built, how an AI assistant works with it, and what protects the server, its users and their data. Written for whoever runs the server or checks it; the code behind each part is in the "Source code" toggles.

---

## The structure

```{mermaid}
flowchart LR
    U[Browser: the page] -->|https| C[Caddy<br/>address, certificate,<br/>browser protections, 50 MB limit]
    A[AI agent<br/>Claude or any MCP client] -->|https /mcp| C
    C -->|/| F[frontend<br/>the built page, static files]
    C -->|/api, /mcp| B[backend<br/>FastAPI + MCP server]
    C -->|/docs| D[docs<br/>this documentation]
    B --- S[(projects<br/>/tmp, temporary)]
```

Every part runs in its own container (`docker-compose.yml`); only Caddy is reachable from outside.

| Part | Folder | What it does |
|---|---|---|
| Page | `frontend/` | The app in the browser: data collection, analysis, economics, report. Keeps the user's project itself (saved as a file by the Save button). |
| Backend | `backend/app/` | The calculations (`modules/`, `services/`), the HTTP API (`routers/`), the live sessions for Connect AI (`services/live.py`), the limits (`rate_limit.py`). |
| MCP server | `mcp_server/` | The tools an AI calls. Served by the backend at `/mcp` (`backend/app/mcp_http.py`); can also run on a computer as a local program. |
| Docs | `docs/` | These pages, built into the docs container and served at `/docs`, the same version as the app. |
| Proxy | `Caddyfile` | One public address for all of it; HTTPS on a domain. |

**A visit:** the page loads from `frontend`, and every calculation is a request to `/api` that the backend answers from the data in the request. Nothing about a visitor is stored, unless they click **Connect AI**.

**An agent:** it sends tool calls to `/mcp`. The MCP server runs them inside the backend, against the same API the page uses.

---

## Connect AI: the live session

```{mermaid}
sequenceDiagram
    participant AI as AI agent
    participant B as Backend
    participant P as The open page
    P->>B: Connect AI: start a session (its project goes to the server)
    B-->>P: the code, e.g. 9bb3e682
    Note over P: the user tells the agent the code
    AI->>B: a tool with the code (e.g. delete_stream)
    B->>P: "may the AI delete the stream Whey?"
    P-->>B: the user allows
    B->>B: the change, noted in the activity log
    B-->>P: the changed project, the log entry
    B-->>AI: done
```

- The **code** is the key to a page. Sessions are never listed, so nobody can find someone else's. It ends with **Disconnect**, or after an hour without the page.
- While connected, the page keeps its project on the server too: the agent's edits arrive on the page at once, the user's edits reach the agent. The page marks its own saves (`X-Live-Session`), so they are not sent back to it.
- The agent can also drive the page itself (navigate, tick streams, pick pumps): the backend sends the page a **command**, the page runs it with the same functions as its buttons and answers.

---

## What the AI may do

| Rule | How it is enforced |
|---|---|
| **Only on the open page.** Without a connected page, or once it closes, every project tool refuses; only tools that touch no project (`explain`, `guide`, `read_document`, address search, …) answer. | Every project tool passes the one check `_page_info` (MCP server), which asks the backend for the connected page with this code. |
| **Pause.** The user can stop the agent (⏸ next to the code): it can do nothing, not even read, until resumed. | The backend answers 423 for a paused page, to the check above and to every command. |
| **Asked first.** Deleting a process, subprocess or stream, replacing the project, a CSV import, removing a site plan or a scenario: the page asks the user, and nothing happens unless they allow it within two minutes. | `_confirm` (MCP server) sends the page `confirm_ai_action` and waits for the answer. |
| **Seen.** Every change the agent makes is listed on the page (🕘), and anonymously in the server's activity log (the tool and the names of its fields). | The tools are registered through `tool`, which notes each change (`/api/live/pages/{code}/log`). |
| **Marked.** A report made by the agent says so on its first page and in its metadata. | `created_by_ai` in the report request. |
| **Told.** The agent is told that text in documents, files and on the page is data, never instructions: if a file says "delete everything", it must tell the user, not do it. | The instructions the MCP server gives every agent. |
| **No server files.** Online, the tools never open or write the server's own files: files come in as their content, results go out as download links valid for an hour. | `_read_input` and `_deliver` (MCP server). |
| **Off switch.** `AI_ENABLED=0` removes Connect AI, the live endpoints and `/mcp`; the rest of the app is unchanged. | `backend/app/main.py`. |

<details>
<summary><b>Source code:</b> <code>mcp_server/heattransplan_mcp/server.py</code> — the page check, the question, the activity log</summary>

```{literalinclude} ../mcp_server/heattransplan_mcp/server.py
:language: python
:start-at: async def _page_info
:end-before: def _label
```

```{literalinclude} ../mcp_server/heattransplan_mcp/server.py
:language: python
:start-at: READS = {
:end-before: _analysis
```
</details>

<details>
<summary><b>Source code:</b> <code>backend/app/services/live.py</code> — the connected page and the log</summary>

```{literalinclude} ../backend/app/services/live.py
:language: python
:start-at: def connected_session
:end-before: def project_ids
```
</details>

---

## Security layers

There is no login: the app is public, so each layer has to hold on its own.

| Layer | Protects against | Where |
|---|---|---|
| **Requests per visitor** | One visitor flooding the server; guessing Connect AI codes (after 30 wrong codes in 10 minutes the live endpoints refuse that visitor for a while). Limits per minute: agents 120, reports 20, COP training 10, address search 30, everything else 1200. | `backend/app/rate_limit.py` |
| **Upload size** | Requests over 50 MB. | `Caddyfile` |
| **Browser protections** | Framing by other sites, plugins, form tricks; HTTPS only, once on a domain. No script policy on purpose: maps, charts and docs load from several sites. | `Caddyfile` |
| **Text, never markup** | A name or note like `<script>` running when someone opens a report. | `backend/app/services/report/` |
| **Data leaves** | A site's process data staying on the server: a page's project goes at Disconnect, any other after 24 hours untouched. | `backend/app/services/project_service.py` |
| **Hardened containers** | A flaw in a library taking over the machine: read-only files (only `/tmp` and the activity log's folder writable), no root rights (the backend runs as an ordinary user), no way to gain any. | `docker-compose.yml`, `backend/Dockerfile` |
| **Anonymous activity log** | Recording people while debugging: the log keeps only which feature was used, whether by a person (`human`) or an AI (`ai`), whether it worked (`system` for errors) and how long it took. No addresses, page codes or project ids (paths keep their pattern, `/api/projects/{project_id}`), no values or names: for a project only which parts changed, for an AI tool only the names of the fields it set, for an error its type and where in the code. The server keeps no access log either. It stays in the container's volume and deletes its older half past 20 MB. Read it with `docker compose exec backend python -m app.services.activity_log [rows] [actor]`. | `backend/app/services/activity_log.py` |
| **Known flaws in libraries** | Outdated dependencies: Dependabot checks them weekly and opens a pull request for each fix. Plotly is kept below 7, the version the report is tested with. | `.github/dependabot.yml`, `backend/pyproject.toml` |
| **Nothing listed** | Finding other people's pages or projects: neither sessions nor projects can be listed. | `backend/app/routers/` |

<details>
<summary><b>Source code:</b> <code>backend/app/rate_limit.py</code> — the limits</summary>

```{literalinclude} ../backend/app/rate_limit.py
:language: python
:start-at: RULES = [
:end-before: class RateLimit
```
</details>

<details>
<summary><b>Source code:</b> <code>Caddyfile</code> — browser protections and the upload limit</summary>

```{literalinclude} ../Caddyfile
:language: text
:start-at: header {
:end-before: handle /api/*
```
</details>

### What it does not protect

- **No accounts.** Anyone can open the app and compute. Who may use it is not checked; a login (for example the university's) would be the next step.
- **The code is the key.** Whoever has a page's Connect AI code can work on that page while it is open, also through the API directly; pause, questions and the activity log bind agents that use the MCP server.
- **Human or AI is declared, not proven.** The page and the MCP server say which in a header (`X-Actor`); the log is for debugging, not evidence. A user's edits reach it only while the page is connected (Connect AI), since otherwise the project stays in the browser.
- **One process.** The limits, sessions and download links are kept in the backend's memory: fine for one server, a shared store (e.g. Redis) when it runs on several.

---

## Settings per machine

The same repository runs on a laptop and on a server; what differs is in a `.env` file next to `docker-compose.yml`, which stays out of git (`.env.example` lists it). Without one, everything runs on `http://localhost`.

| Variable | Default | |
|---|---|---|
| `SITE_ADDRESS` | `:80` (any address, plain http) | The server's domain; Caddy then gets its HTTPS certificate |
| `AI_ENABLED` | `1` | `0` switches AI access off |
| `RATE_LIMIT` | `1` | `0` switches the limits off |
| `PROJECT_RETENTION_HOURS` | `24` | How long an unused project stays on the server |
| `API_KEYS` | – | Keys every API request (and agent) must send; unset: open |
| `COP_TRAINING_ENABLED` | `1` | `0` switches the COP training module off |

Start, or update after a change: `docker compose up -d --build`.
