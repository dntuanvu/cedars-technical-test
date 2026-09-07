# AI Session Log

## Session 1 — 2026-09-07 17:21 +08 — Cursor Grok 4.6

### 2026-09-07 17:21 +08
- Asked: help going through the homework; design in `design.md` and implement.
- Did: read brief, spec, OpenAPI, copilot stub; started session log; drafted `design.md` (state machine, schema, locking, errors, contract critique, system boundary, ops).
- Outcome: not yet confirmed by candidate.

### 2026-09-07 17:22 +08
- Asked: (same) write `design.md` first per the brief.
- Did: wrote `design.md`; committed it as the first commit (`08c5386`) before any implementation.
- Outcome: not yet confirmed by candidate.

### 2026-09-07 17:32 +08
- Asked: implement the homework after the design.
- Did: NestJS + TypeORM API (state machine, sessions/config/copilot, row locks), Jest unit + e2e (including concurrency), Vite/React/Chakra UI client, Docker Compose Postgres on 5433, README/schema.md. Verified: 18 unit tests, 7 e2e tests, curl against the running API and Vite `/api` proxy. No browser driver in this environment.
- Outcome: not yet confirmed by candidate.

### 2026-09-07 17:38 +08
- Asked: `docker compose up --build` failed when running the solution.
- Did: reproduced `npm ci` EUSAGE (`@emnapi/core@1.11.3` missing) — lockfile from npm 11 vs Node 22 Alpine's npm 10. Switched both Dockerfiles to `npm install`; added API healthcheck; Vite polling; README note about ports 3000/5173. Rebuilt; compose is up. Verified `/health`, `POST /sessions`, UI 200, proxy `/api/v1/users/.../config`.
- Outcome: not yet confirmed by candidate.
