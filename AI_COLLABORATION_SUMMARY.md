# AI Collaboration Summary

## Overview

- Tool/model: Cursor Grok 4.6 (Cursor IDE agent, timestamps from `date`, verified).
- Sessions: 1
- Estimated hours: **~2 h 9 m** (Session 1 span 2026-09-07 17:21 +08 → 19:30 +08). Git commits on `main` run 17:22 → 19:27 +08 and corroborate that window. No unverified timestamps.

## Timeline

- **Session 1 — 2026-09-07 17:21 +08 → 19:30 +08:** wrote and committed `design.md` before implementation; built NestJS/TypeORM API, copilot agent, Vite/Chakra UI client, tests, Compose; fixed Alpine `npm ci` lockfile mismatch so `docker compose up --build` works; retried a failed GitHub push after a 443 timeout; generated this summary after the candidate confirmed a local run.

## Division of labor

**AI produced:** `design.md` (state machine, schema, locking, contract critique, system/ops sections); NestJS backend (domain timer, sessions/config/copilot, row locks); Jest unit + e2e (including concurrent pause/stop); Vite + React + Chakra UI page; Dockerfiles, `docker-compose.yml`, root README, `schema.md`; `ai-session-log.md` entries; this file.

**Candidate directed, decided, or did:** chose Cursor and this repo; asked for design-then-implement per the brief; ran the solution and reported Compose/`npm ci` failure and a GitHub 443 timeout; confirmed it works locally; commit `a789a374` (`fixed docker compose`) authored by Vu Dinh (session-log append only); requested wrap-up.

No logged case of the candidate rewriting AI application code. Interpretations in `design.md` / README (long-break every 4 work intervals; `X-User-Id` on current-session routes) were proposed by the AI and left in place.

## AI mistakes & corrections

- **Docker `npm ci` vs lockfile (logged 17:38).** Dockerfiles used `npm ci`. Node 22 Alpine ships npm 10; the lockfile came from npm 11 and lacked `@emnapi/core@1.11.3`. Caught when the candidate ran `docker compose up --build`. Fixed by switching both images to `npm install --no-audit --no-fund`, plus an API healthcheck and a README note about ports 3000/5173.

- GitHub `Failed to connect to github.com port 443` was a transient network drop, not an AI code defect. Retry succeeded.

## Verification

- Backend unit tests: 18 passed (state machine + copilot validation, including invalid-tool-call → 422 and no side effects).
- Backend e2e: 7 passed, including concurrent pause/stop against Postgres (no 500; final status 404).
- Manual curl: start session 201, pause, 409 already-active, copilot 422 `COPILOT_INVALID_TOOL_CALL`, remaining seconds counting down; Vite `/api` proxy to the API.
- After the Docker fix: `docker compose up --build`; `/health`, `POST /sessions`, UI HTTP 200, proxy `GET /api/v1/users/.../config`.
- Candidate (19:30): works locally.
- Contract: implemented OpenAPI field names/casing/status codes as-is; documented spec vs contract long-break (4 vs 3) and missing `userId` on current-session routes.
