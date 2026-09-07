# Pomodoro Timer

Contract-first take-home: NestJS + PostgreSQL API implementing `homework/openapi.yaml`, and a React + Chakra UI client.

Architecture decisions live in [`design.md`](./design.md) (committed before implementation). Schema notes: [`schema.md`](./schema.md).

## One-command setup

```bash
docker compose up --build
```

- App: http://localhost:5173
- API: http://localhost:3000/api/v1
- Health: http://localhost:3000/health

Postgres is published on `localhost:5433` (`pomodoro` / `pomodoro` / `pomodoro`) so it does not collide with a local Postgres on 5432. The API container still talks to `postgres:5432` on the compose network.

Stop anything already bound to **3000** or **5173** (local `npm run start:dev` / `npm run dev`) before Compose, or those port mappings will fail.

## Local development

```bash
docker compose up -d postgres
cd backend && npm install && npm run start:dev
# another terminal
cd frontend && npm install && npm run dev
```

Frontend Vite proxies `/api` to `http://localhost:3000`.

## Tests

```bash
cd backend
npm test          # unit tests (state machine + copilot validation)
npm run test:e2e  # API + concurrency (requires Postgres up)
```

## Identity interpretation

`GET/PATCH /sessions/current*` have no `userId` in the contract. The server requires header `X-User-Id`. The UI sends it on those calls. See `design.md`.

## Long-break cadence

Spec acceptance criteria: long break after **4** completed work intervals. OpenAPI description says 3 and the example is inconsistent. This implementation uses **4**. Documented in `design.md`.
