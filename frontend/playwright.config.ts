import { defineConfig, devices } from '@playwright/test';

// The main path in a real browser: the dev server in front of the real
// backend. `npx playwright test` starts both (or reuses running ones locally).
// The backend uses backend/.venv when there is one (a checkout), else python.
const python =
  'if [ -x .venv/bin/python ]; then P=.venv/bin/python; else P=python; fi; ' +
  'exec $P -m uvicorn app.main:app --port 8000';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `sh -c '${python}'`,
      cwd: '../backend',
      url: 'http://127.0.0.1:8000/api/health',
      reuseExistingServer: !process.env.CI,
      env: { RATE_LIMIT: '0', MPLBACKEND: 'Agg' },
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
