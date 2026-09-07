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
