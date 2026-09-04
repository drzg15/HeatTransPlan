---
title: Heattransplanapp
colorFrom: red
colorTo: red
sdk: docker
app_port: 7860
---

# Heattransplanapp

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


#second temrinal
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173