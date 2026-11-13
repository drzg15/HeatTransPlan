# Task: API keys for the backend API and the MCP server

Brief for the agent implementing this. Read it fully before you start.

## Goal

Every request to the backend API (`/api/*`) and to the MCP server (`/mcp`) needs a valid key. The app should not be open to anonymous scripts and agents, but **anybody can get a key with one click**: no email, no approval, no account.

The owner's decisions so far:

- **No email** and no sign-up. A key is issued at once.
- **No expiry** for user keys.
- **Claude.ai and ChatGPT must keep working.** Their connectors cannot send custom headers (they support only no auth or OAuth), so `/mcp` must also accept the key as a URL query parameter.

What keys are for here: limits per key instead of per IP, switching off one misused key without touching anyone else, and seeing anonymous usage per key. They are not meant to keep anyone out.

## Hard constraints

1. **The server stores nothing about users or projects.** This is a firm owner requirement: the page says "Der Server rechnet nur, er speichert nichts". So no database of keys, no key files written at runtime, no user records. Keys must be **verifiable without storage** (signed, see below). The only allowed state is configuration in `.env` (the secret, a blocklist), set by the operator.
2. **The web page must keep working for a normal visitor without them doing anything.** They never see or paste a key.
3. **Don't break the AI connection.** Connect AI on the page, plus the MCP tools, must work as before, with the key added.
4. **Work on `general_dev`** in `/root/git/HeatTransPlan_test`, a git worktree of the same repo. Test on the test stack (see Testing) before anything goes near the live app. Don't touch `/root/git/HeatTransPlan` (that's `main`, the live site). Don't deploy to live. Commit or push only when the owner asks.

## Prerequisite: merge the no-storage change first

On 2026-11-13 the server-side project store was removed on `main`. The no-storage section of the 2026-11-13 entry in the [Context](#context-what-changed-recently) section below lists exactly what changed. At the time of writing, those changes exist **only as uncommitted changes in `/root/git/HeatTransPlan` (branch `main`)**, together with a Caddyfile fix (OAuth discovery returns 404). `general_dev` doesn't have them.

Before you start: ask the owner to commit and push `main`, then merge `main` into `general_dev`. Don't build on top of `general_dev` without them. The key design below assumes there is no `/api/projects` and no project store.

## Design

### Key format: signed, so nothing is stored

- Secret: `API_KEY_SECRET` in `.env` (random, at least 32 bytes, never committed). If it's unset, key checking is **off**, which is how local development and tests work today with `API_KEYS` unset.
- A user key: `htp_<id>.<sig>`
  - `id`: 16 random bytes, base64url without padding.
  - `sig`: HMAC-SHA256 over `"user:" + id` with `API_KEY_SECRET`, base64url, truncated to 32 characters if you like.
  - Valid if the signature matches and `id` isn't on the blocklist. No expiry.
- A page token (for the web page itself, see below): `htp_page_<id>.<exp>.<sig>`, with `sig` over `"page:" + id + ":" + exp`. It's valid until `exp`, a unix time, which should be about 24 hours after issue.
- Compare signatures with `hmac.compare_digest`.
- Blocklist: `API_KEY_BLOCKLIST` in `.env`, comma-separated key ids. Read it at startup; a restart applies changes.
- Rotating `API_KEY_SECRET` invalidates every key. Write that in the docs as the emergency switch.
- Keep the existing static `API_KEYS` env var working as operator/admin keys, accepted as they are.

### Where the key goes

- **HTTP API:** header `X-API-Key: <key>`. Also accept `Authorization: Bearer <key>`.
- **MCP:** the header as above, or the query parameter `?key=<key>` on `/mcp`. That one is for Claude.ai and ChatGPT, where the user pastes `https://heattransplan.uni-paderborn.de/mcp?key=htp_...` as the connector URL.
  - A key in a URL can end up in logs and browser history. Make sure neither Caddy nor uvicorn logs query strings. Uvicorn runs with `--no-access-log` already; check Caddy has no `log` directive that would record URIs, and that the activity log (`backend/app/services/activity_log.py`) stores the path pattern only, never the query.
  - Strip `key` from the query before the request reaches the MCP app, or at least never echo it back.

### How a visitor gets a key

- `POST /api/keys` (no key required) issues a new user key and returns `{"key": "htp_..."}`. It stores nothing. Rate-limit it per IP, tightly (for example 5 per hour), in `backend/app/rate_limit.py` `RULES`.
- On the page: a small **"API key"** entry. The Connect AI dialog (`frontend/src/live/LiveSetup.tsx`) is the natural place, since that's where agent setup is explained. One button, "Get a key", shows the key with a copy button and a one-line note: "Keep it; it is shown only once and cannot be recovered." Then setup snippets with the key filled in:
  - the Claude.ai/ChatGPT connector URL `…/mcp?key=…`
  - a header config for Claude Code (`claude mcp add --transport http heattransplan https://…/mcp --header "Authorization: Bearer …"`), Cursor and Claude Desktop.
- The browser may keep the key in `localStorage` as a convenience, so the dialog shows it again on this device. That's in the visitor's own browser, not on the server, so it's fine.
- Texts in both `frontend/src/locales/de.json` and `en.json`.

### The page's own requests

The page calls `/api/*` for every analysis, so it needs a key too. Anything built into the JavaScript is public, so **don't** bake a key in with `VITE_API_KEY` for production. Instead:

- `POST /api/keys/page` (no key required, rate-limited per IP, for example 30 per hour) returns a page token valid for about 24 hours.
- `frontend/src/api/client.ts` fetches one on first use and keeps it in memory (or `sessionStorage`). It sends it as `X-API-Key` on every request and fetches a new one when the token expires or a request gets 401/403.
- The live event stream in `frontend/src/live/liveClient.ts` uses `fetch` with the header. Use the same token there.

Anyone could fetch page tokens with a script too. That's accepted: they're short-lived and rate-limited per IP, and the point is limits and blocking, not secrecy.

### What stays without a key

- `GET /api/health`, `GET /api/features` (the page needs it before it has a token), `POST /api/keys`, `POST /api/keys/page`.
- `GET /api/mcp/files/{token}/{name}`: one-time download links the AI hands to the user. They open in the browser, which can't send a header, and the token in the link already is the secret.
- Static files: the frontend and `/docs`.
- The MCP server's internal calls into the backend carry `INTERNAL_TOKEN` (see `rate_limit.py`) and must keep working. Treat that header as authorised.

### Rate limits per key

`backend/app/rate_limit.py` counts per IP today. Count per key id when a valid key is present, and per IP otherwise (only the no-key endpoints). Keep the existing `RULES` numbers per key. Counts stay in memory, as now.

### Activity log

`backend/app/services/activity_log.py` is anonymous by design: never who, never data. Don't add the key or its id. If usage per key is wanted, add a separate in-memory counter that resets on restart, and ask the owner first.

## Where the code is

| What | File |
|---|---|
| Today's key check (static `API_KEYS`, header `X-API-Key`) | `backend/app/dependencies.py` (`verify_api_key`) |
| Where it's applied to routers | `backend/app/main.py` (`api_dependencies`) |
| MCP over HTTP, mentions API_KEYS for `/mcp` | `backend/app/mcp_http.py` |
| Per-IP rate limiting, `INTERNAL_TOKEN` | `backend/app/rate_limit.py` |
| Frontend HTTP client, `VITE_API_KEY` | `frontend/src/api/client.ts` |
| Live connection (event stream with fetch) | `frontend/src/live/liveClient.ts` |
| Connect AI dialog | `frontend/src/live/LiveSetup.tsx` |
| Public routes in Caddy | `Caddyfile` |
| Settings documented | `.env.example`, `README.md` (env table), `docs/architecture_and_security.md`, `docs/api_and_mcp.md` (the Authentication section) |

`dependencies.py` today only covers routers registered with `api_dependencies`. Check that every `/api` router and `/mcp` is covered, so nothing is left open by accident.

## Testing

- **Backend tests** run in a throwaway container from the backend image. pytest isn't in the image, so install it inside:
  ```
  cd /root/git/HeatTransPlan_test
  docker run --rm -v "$PWD":/src:ro -w /src/backend --entrypoint sh heattransplan-backend_test -c \
    'pip install -q pytest pytest-asyncio httpx >/dev/null 2>&1; PYTHONPATH=/src/backend:/src/mcp_server python -m pytest -q -p no:cacheprovider tests'
  ```
  Known failures that predate this task: the four `tests/test_golden.py::test_analysis_chain[...]` tests (a floating-point difference). They're not yours to fix, but don't add new failures.
- **Frontend tests:** there's no Node on the host. Run in `node:20-alpine` on a copy outside the repo (`npm ci && npx tsc -b && npx vitest run`). Known failures that predate this task: 5 tests in `src/live/commands.test.ts`.
- **New tests to add**, at least:
  - A valid user key passes; a tampered signature, an unknown format or a blocklisted id gets 403 on `/api/*` and `/mcp`.
  - Without `API_KEY_SECRET`, everything passes, as today.
  - A page token passes before `exp` and fails after.
  - `?key=` works on `/mcp` and is never logged (check the activity log rows).
  - The no-key endpoints listed above stay reachable without a key.
  - `POST /api/keys` writes nothing: no new files, nothing kept in module state.
  - The MCP server's internal calls still work with keys on.
- **Test stack:** `general_dev` runs on the server as a separate Docker Compose project, reachable only at `http://127.0.0.1:8081`. The owner opens it through VS Code port forwarding. Rebuild it with:
  ```
  cd /root/git/HeatTransPlan_test
  docker compose -p heattransplan_test -f docker-compose.yml -f docker-compose.test.yml up -d --build
  ```
  Always pass `-p heattransplan_test` and both `-f` files. Without them, Compose treats the command as the live project and replaces the live containers. `docker-compose.test.yml` is local and untracked. Put `API_KEY_SECRET` (and `AI_ENABLED=1`) into a `.env` in this folder for the test stack. `.env` is gitignored.
- **End to end** on the test stack: open the page, run an analysis, Connect AI, get a key, connect an MCP client with it (header and `?key=`), and check that requests without a key get 403.

## Done means

- The tests above pass, with no new failures.
- It's tested on the test stack end to end.
- The docs and `.env.example` explain `API_KEY_SECRET`, `API_KEY_BLOCKLIST`, how to get a key, how to block one, and how to rotate the secret.
- The privacy text stays true: nothing about keys or users is stored on the server.
- The owner is told, in the final report, what's ready for review. Don't merge into `main` or deploy live yourself.

## Context: what changed recently

- **2026-11-13: no storage.** The server-side project store (`backend/app/services/project_service.py`, the `/api/projects` router) was removed. Live sessions are a pure relay: the AI reads and edits the project only through commands the open page runs. `/api/io/*` endpoints are stateless (`POST /api/io/export-csv` and so on take the project in the body). AI download links work once and expire after 10 minutes.
- **2026-11-13: MCP connections.** Connecting broke because the SPA answered `/.well-known/oauth-*` and `/register` with 200 HTML. The live `Caddyfile` now returns 404 there. With keys, still don't advertise OAuth: keys come by header or `?key=`.
- **2026-11-13: AI on.** `AI_ENABLED=1` in production.
