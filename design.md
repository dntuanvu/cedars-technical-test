# Pomodoro Timer — Design

Engineering-lean. Contract (`homework/openapi.yaml`) is implemented as-is; interpretations are called out.

## Timer state machine

Visible `mode`: `work` | `short_break` | `long_break` | `idle`.
Internal `runState`: `running` | `paused` | `idle`. (`idle` always pairs with `mode=idle`.)

The contract has no `paused` flag. Pause is a `runState` the server persists; the client infers it from a successful `pause` / `resume` and from `remainingSeconds` not decreasing across polls.

```
                    POST /sessions (201)
         ┌──────────────────────────────────────────┐
         │                                          ▼
      [idle]                                 [work, running]
         ▲                                    │         ▲
         │                            tick→0  │         │  tick→0
         │                     (completedCycles++)      │  (break done)
         │                            │                 │
         │                            ▼                 │
         │              completedCycles % 4 == 0 ?      │
         │                   │ yes          │ no        │
         │                   ▼              ▼           │
         │         [long_break, run]  [short_break, run]┘
         │                   │              │
         │                   └──────┬───────┘
         │                          │ PATCH stop
         └──────────────────────────┘
```

| Trigger | From | To |
|---|---|---|
| `POST /sessions` | idle (or no row) | `work` + running; `remaining` = `workMinutes * 60` (rounded); new `sessionId` |
| `POST /sessions` | any non-idle | **409** `SESSION_ALREADY_ACTIVE` (paused still counts as active) |
| `PATCH pause` | running (any interval) | same mode, paused; freeze remaining seconds |
| `PATCH pause` | already paused | no-op, 200 (idempotent) |
| `PATCH resume` | paused | same mode, running; deadline = now + remaining |
| `PATCH resume` | already running | no-op, 200 |
| `PATCH stop` | any non-idle | `idle`; `completedCycles` kept |
| `PATCH *` / `GET status` | no non-idle session | **404** `NO_ACTIVE_SESSION` |
| Interval elapses (lazy, on any session read/write) | `work` running, remaining hits 0 | increment `completedCycles`; start `long_break` if `completedCycles % 4 == 0`, else `short_break` |
| Interval elapses | break running, remaining hits 0 | start `work` |

Long-break rule (interpretation): **every 4 completed work intervals**, per spec acceptance criteria. OpenAPI says 3 — see Contract feedback.

`cyclesUntilLongBreak = 4 - (completedCycles % 4)`, except `0 → 4` (so 0,4,8… map to 4). Next break is long iff the work about to complete would make `completedCycles % 4 == 0`.

Stop response is 200 + `mode: idle`. Subsequent `GET /sessions/current/status` is **404** (no active session). Cycle count lives on the user, not the session, so it survives stop and restart.

## Server-authoritative time

- While `running`, persist `deadlineAt` (timestamptz). `remainingSeconds = max(0, floor((deadlineAt - now) / 1000))`.
- While `paused`, persist integer `remainingSeconds`; `deadlineAt` is null.
- No in-memory ticker. Elapsed intervals are applied lazily inside the locked transaction on GET/PATCH/POST. Multiple skipped intervals (client was away / process restarted) are replayed in a loop using **current** config for subsequent interval lengths. The in-flight interval’s remaining time is whatever was already captured in `deadlineAt` / `remainingSeconds` (config PUT does not rewrite an in-flight deadline).
- Conversion: `seconds = round(minutes * 60)` (config allows fractional minutes, e.g. 25.5).

## Concurrency

**Strategy: pessimistic row lock, last-command-wins in lock order.**

- Every session mutation **and** status read that may materialize transitions does `SELECT … FOR UPDATE` on that user’s session row (and the user row for `completedCycles`) inside a transaction.
- Postgres is the lock manager → safe across multiple API instances. No extra HTTP code on PATCH (contract only lists 200/404).
- Semantics: concurrent pause/resume/stop serialize. Example: stop-then-pause → pause sees idle → 404. pause-then-stop → idle, 200.
- Rejected optimistic `409` on PATCH: contract already uses 409 for “session already active”; adding a second 409 meaning on a different path would be unstated and client-unfriendly. A `version` column is still stored for debugging / future use, not for HTTP conflict.

## Database schema

```
users
  id                    varchar PK          client-supplied opaque id (no auth in contract)
  completed_cycles      int NOT NULL ≥ 0    per-user, survives stop/restart
  created_at            timestamptz

timer_configs
  user_id               PK, FK users        1:1
  work_minutes          numeric(6,2) > 0
  short_break_minutes   numeric(6,2) > 0
  long_break_minutes    numeric(6,2) > 0
  updated_at            timestamptz

timer_sessions          at most one row per user (current/most-recent)
  id                    uuid PK             exposed as sessionId
  user_id               varchar UNIQUE FK
  mode                  check enum
  run_state             check enum
  remaining_seconds     int ≥ 0             source of truth when paused
  deadline_at           timestamptz NULL    source of truth when running
  version               int                 not used for HTTP 409
  created_at / updated_at
```

Indexes: PK/UNIQUE only. No sweeper query, no listing endpoint.

**Why this shape**

- Users are implicit: first `POST /sessions` or config access upserts. No user CRUD in the contract.
- `completed_cycles` on `users`, not sessions — contract field is “for this user”.
- One session row per user (UNIQUE `user_id`): matches “current or most recent”; history is out of scope. New `id` issued on each `POST /sessions`.
- `deadline_at` rather than “remaining + last tick timestamp”: remaining is a pure function of wall clock; no drift from repeated snapshot writes.

**Rejected**

- Event-sourced interval log: correct but overkill for 4–6h and unused (no analytics).
- In-memory timer + DB snapshot on pause only: fails “survives process restart” while running.
- Separate `session_events` / history table: out of spec.
- JSON blob for config+session: weaker constraints, harder migrations.

Defaults when a user is first seen: 25 / 5 / 15 minutes (classic Pomodoro; not named in the contract, documented here).

## Error semantics

| Status | Code | When |
|---|---|---|
| 201 | — | `POST /sessions` started |
| 200 | — | PATCH applied; GET status (active); GET/PUT config |
| 400 | `VALIDATION_ERROR` | malformed body, missing `X-User-Id` on current-session routes, non-positive durations. **Not in OpenAPI**; added because `exclusiveMinimum: 0` is otherwise unenforceable. |
| 404 | `NO_ACTIVE_SESSION` | GET/PATCH current when idle or no row |
| 409 | `SESSION_ALREADY_ACTIVE` | `POST /sessions` while mode ≠ idle |
| 422 | `COPILOT_INVALID_TOOL_CALL` | unknown tool, out-of-range args, missing required args |
| 500 | `INTERNAL_ERROR` | unexpected only — never for bad LLM output |

Copilot: **validate the entire tool-call list first**. Any invalid call → 422, **no side effects**. Success → 200 with audit trail (`executed` only; `rejected` appears if we ever execute-partially — we don’t). Empty provider output → 200, `toolCalls: []`, explanatory `message`.

`GET /users/{id}/config` always 200 (upsert defaults). No 404 in contract.

## Identity gap (sessions)

`POST /sessions` carries `userId`. `GET/PATCH /sessions/current*` do **not**.

**Interpretation:** require header `X-User-Id` on those three operations. Frontend sends it on every session call. Noted as the highest-priority contract fix below.

## Contract feedback (critique only; implement as-is)

1. **User on current-session routes** — add `userId` query/header or real auth. Today the resource `/sessions/current` is undefined in a multi-user API.
2. **Paused flag** — add `runState: running | paused | idle` (or `paused: boolean`). Clients cannot distinguish pause from a stuck clock without extra inference.
3. **Long-break cadence** — spec AC = every **4** work intervals; `SessionStatus.cyclesUntilLongBreak` description = every **3**; example `{completedCycles: 2, cyclesUntilLongBreak: 3}` matches neither `4-(n%4)` nor `3-(n%3)`. Treat the example as non-normative; implement **4**.
4. **PATCH 404 vs stop** — confirm GET after stop is 404 (we assume yes). Returning idle as 200 on GET would be simpler for UIs.
5. **409 on PATCH** — if optimistic locking is desired, specify `409 CONCURRENT_MODIFICATION` explicitly so it doesn’t collide with `SESSION_ALREADY_ACTIVE`.
6. **Config validation errors** — declare 400 for `exclusiveMinimum` violations.
7. **Copilot 422 vs audit** — 422 body is `Error`, so rejected calls never appear in `toolCalls`. Prefer 200 with `status: rejected` entries, or include `toolCalls` on 422.
8. **`cyclesUntilLongBreak` wording vs classic Pomodoro** — “every 4 completed works” is the technique; align description and example with the formula.

## System boundary (module inside a productivity SaaS)

**Timer owns:** per-user interval config, current session (mode, deadline, pause), per-user `completedCycles`.

**Timer exposes (sync):** today’s HTTP API. Internally, a small application service (`TimerService`) is the module façade other backends would call in-process today.

**Timer does not own:** user identity/profile, tasks, timesheets, billing.

**Events we would publish (not implemented; contract has none):**

| Event | When | Consumers |
|---|---|---|
| `timer.interval.completed` | work/break hits 0 | time-tracking (billable minutes), tasks (“pomodoro done”) |
| `timer.session.started` / `.stopped` | POST / stop | presence, team boards |
| `timer.session.paused` / `.resumed` | PATCH | optional analytics |

**Events we would consume:** none required. Optional: `user.deleted` → cascade.

**Cross-module data:** `userId` is a shared identifier, not a join to a Users service table in this homework. Task↔timer linking would be a new association owned by Tasks or a thin mapping service — not a Timer table.

**Extract to a standalone service later**

- Already: DB tables are Timer-only; HTTP contract is the boundary; lazy timing has no in-process daemon; locking is in Postgres (shared DB or moved with the service).
- Would change: in-process `TimerService` calls → HTTP/gRPC; domain events → real bus (outbox); `userId` validation → Identity service; config defaults possibly owned by a Settings service; traces/metrics namespacing.

## Infrastructure & operations

**Technology**

| Choice | Why | Trade-off |
|---|---|---|
| PostgreSQL | Required; ACID row locks; durable timer state | Heavier than Redis for a countdown, but restart-safety and multi-instance locking come free |
| No Redis | Deadline math is O(1) per request; no hot leaderboard | Would add Redis later only for pub/sub fanout (out of spec) |
| No queue | No async work; copilot is request-scoped | A bus appears when we publish domain events |
| NestJS + TypeORM | Specified | TypeORM tx + `pessimistic_write` is enough for `FOR UPDATE` |

**Concurrency at scale**

- Multiple instances + one Postgres: `SELECT FOR UPDATE` is sufficient. Without it, two GETs after a deadline could both apply `completedCycles++`.
- Distributed lock (Redis) is unnecessary while Postgres is the source of truth.
- What breaks without locking: double cycle increment, skipped/duplicated auto-break, pause overwriting a stop.

**Deployment**

- Container (API) + managed Postgres. K8s Deployment, rolling update, `maxUnavailable: 0` / `maxSurge: 1`, readiness = process up + DB ping.
- Running timers: **no special drain**. State is `deadlineAt` in DB; a killed pod loses nothing. In-flight HTTP requests retry from the client.
- Config/schema migrations: expand-contract; avoid exclusive locks on `timer_sessions`.
- Copilot/LLM: out of band; stub is in-process. A real provider should be called with a tight timeout so deploys aren’t blocked.

**Observability**

- Metrics: `session_start_total`, `session_action_total{action}`, `session_conflict_total` (409), `copilot_invalid_total`, `interval_complete_total{mode}`, request latency, `db_tx_lock_wait`.
- Logs: structured `{userId, sessionId, action, mode}` — no utterance bodies in prod logs by default (PII).
- Alerts: p99 latency; 5xx; lock-wait spikes; error-rate on PATCH; “no successful GET status in N min” is **not** a page (users idle is normal).
- Unhealthy: DB unreachable (readiness fail); lock waits climbing (contention or missing index); remainingSeconds going negative (bug — should be impossible with CHECK + `max(0,…)`).

**Availability**

- Down API: users cannot start/pause/see time. Countdown itself is a timestamp in Postgres — **time keeps elapsing**; on recovery, lazy replay catches up. That is the intended degradation.
- Client-side fallback countdown: tempting for UX, forbidden as source of truth; OK as cosmetic animation between polls, reconciled every poll.
- Redundancy: ≥2 API replicas; Postgres HA (primary + failover). Not worth: client-only timer, multi-region active-active (clock + conflict story is more than this module needs).
- Copilot down: timer CRUD still works if we isolate the LLM client; 5xx/timeout only on `/copilot/commands`.
