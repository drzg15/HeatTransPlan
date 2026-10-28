# HeatTransPlan

**HeatTransPlan** is a web application for collecting industrial process energy data and analysing heat recovery potential and heat pump integration opportunities using **pinch analysis**.

It is developed as part of the [HeatTransPlan research project](https://www.heattransplan.de/) at the University of Paderborn. A live instance is available at [heattransplan.uni-paderborn.de](https://heattransplan.uni-paderborn.de/).

---

## Features

- **Interactive map** — Geolocate industrial facilities and place processes on a map canvas.
- **Energy Data Collection** — Define processes, sub-processes, hot/cold streams, temperatures, flow rates, and operating hours.
- **Pinch Analysis** — Automatically compute composite curves, the grand composite curve, pinch point, and minimum heating/cooling demands.
- **Heat Pump Integration** — Evaluate and optimise heat pump solutions across feasible temperature lifts, with COP modelling and refrigerant selection.
- **Economic Analysis** — Net present value (VDI 2067-1), dynamic payback, CO₂ saving, break-even electricity price, energy price sensitivity map and economic heat pump size, against a gas, oil or electric boiler.
- **Scenario Comparison** — Save stream selections as scenarios and compare utilities, heat pump coverage and economics side by side.
- **HTML Report** — Export every scenario, its charts, its economic analysis and the scenario comparison as one interactive HTML file.
- **Import / Export** — Save and load project state as JSON; export stream data and distance matrices as CSV; export map screenshots.
- **Multilingual** — English and German UI (i18n ready).
- **Dark / Light mode** — Theme toggle built in.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript (Vite) |
| Backend | Python 3.11+ · FastAPI · Uvicorn |
| ML / Analysis | scikit-learn · XGBoost · NumPy · pandas |
| Maps | Leaflet (via react-leaflet) · staticmap · folium |
| Charts | Plotly |
| Reverse proxy (prod) | Caddy |
| Container (prod) | Docker / Docker Compose |

---

## Getting Started

### Prerequisites

- **Node.js ≥ 20** and **npm**
- **Python ≥ 3.11**

### 1 — Clone the repository

```bash
git clone https://github.com/your-org/HeatTransPlan.git
cd HeatTransPlan
```

### 2 — Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/api/docs`

### 3 — Start the frontend (separate terminal)

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open `http://localhost:5173` in your browser.

---

## Running with Docker (production)

The Docker Compose stack runs the backend, frontend, and a Caddy reverse proxy together.

```bash
docker compose up -d --build
```

Without settings it serves `http://localhost` (with the MCP server for AI
agents at `http://localhost/mcp`), so the whole stack can be tested on your
own computer. On a server, copy `.env.example` to `.env` and set
`SITE_ADDRESS` to its domain; Caddy then gets the TLS certificate and serves
ports `80` and `443`. `.env` stays out of git.

---

## Environment Variables

### Backend

| Variable | Default | Description |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5173,...` | Comma-separated list of allowed CORS origins |
| `HOST` | `0.0.0.0` | Bind host |
| `PORT` | `8000` | Bind port |
| `API_KEYS` | *(empty — auth disabled)* | Comma-separated API keys for `X-API-Key` header auth |
| `HEATTRANSPLAN_STATE_DIR` | `/app/state` | Directory for persisted project state |
| `AI_ENABLED` | `1` | `0` switches AI access off: the Connect AI button, the live endpoints and the MCP server at `/mcp`. The rest of the app is unchanged |
| `COP_TRAINING_ENABLED` | `1` | `0` switches the COP training module off: its endpoints, its button on the page, and trained models in the optimization |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE` | *(empty — same origin)* | Override API base URL (e.g. `http://localhost:8000`) |

---

## Project Structure

```
HeatTransPlan/
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── routers/    # API routes (projects, processes, streams, analysis, …)
│   │   ├── services/   # Business logic
│   │   ├── modules/    # Pinch analysis & heat pump integration engine
│   │   └── models/     # Pydantic schemas
│   └── pyproject.toml
├── frontend/           # React + TypeScript SPA
│   ├── src/
│   │   ├── pages/      # HomePage, DataCollectionPage, PotentialAnalysisPage
│   │   ├── components/ # Reusable UI components
│   │   ├── api/        # API client functions
│   │   ├── store/      # Zustand state management
│   │   └── locales/    # i18n strings (en, de)
│   └── package.json
├── models/             # Pre-trained COP model artefacts
├── data/               # Example projects and process model definitions
├── Dockerfile          # Multi-stage build (frontend → backend → single image)
├── docker-compose.yml  # Production stack (backend + frontend + Caddy)
└── Caddyfile           # Reverse proxy config
```

---

## AI assistants (MCP)

`mcp_server/` is an MCP server that lets an AI assistant do what the pages
do: build and edit projects, run the potential analysis and the economic
analysis, write reports, and — after **Connect AI** in the header — watch
and drive the open page. Setup and tools: [mcp_server/README.md](mcp_server/README.md).

## Running Tests

```bash
# Backend
cd backend
pip install -e ".[dev]"
pytest

# Frontend
cd frontend
npm test
```

---

## License

See [LICENSE](LICENSE) for details.