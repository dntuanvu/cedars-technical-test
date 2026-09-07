# Cedars Digital Full-Stack Test: Pomodoro Timer, Contract-First

Build a full-stack Pomodoro timer. Unlike a typical take-home, **we provide the API contract and spec — the contract is the source of truth**, exactly as in our daily workflow.

## What we provide

- `homework/spec.md` — user story + acceptance criteria
- `homework/openapi.yaml` — the API contract: paths, schemas, examples. **Implement it exactly: field names, casing, status codes.**

## What you build

**Backend — NestJS + TypeScript + TypeORM + PostgreSQL**

- Endpoints per the contract: start a session, pause/resume, stop, get current status, get/update user timer configuration
- Business logic: work → short break automatically; long break per the spec's cycle rule; pause preserves state per spec
- **Database schema design matters**: tables for users, sessions, configurations — column types, constraints, relationships, indexes where justified (document it in the README or a `schema.md`)
- Unit tests (Jest) for business logic and endpoints; e2e tests are a plus

**Frontend — React + TypeScript + Chakra UI**

- One page: timer display (mm:ss), start/pause/reset, work/break mode indicator, cycle counter, driven by your API (not local-only state)
- Next.js optional; Vite is fine. Keep it simple but real.

## AI policy — read carefully

We *encourage* you to use AI coding agents (Claude Code, Codex, Gemini CLI, Copilot, Cursor — your choice), exactly as you would on the job.

1. **At the start of every AI session, paste the "Session Log Prompt" we provide** (`ai-session-log-prompt.md`). It makes your agent keep `ai-session-log.md` up to date as you work.
2. Before submitting, tell your agent: *"Generate the interview summary"* — it will produce `AI_COLLABORATION_SUMMARY.md`. Submit both files in the repo.
3. Commit regularly with meaningful messages — your commit history is part of your submission.
4. Optionally attach raw session transcripts. They help us better understand how you work.

Not using AI at all is allowed, but you'll be asked to demonstrate AI collaboration live in the interview either way.

## Timer Copilot (required) (+1–2 hours)

Add an agentic endpoint, `POST /copilot/commands` (contract in `homework/openapi.yaml`): the request carries a natural-language utterance like *"Start a 50-minute deep work session, then take a short break."* Your backend turns it into **tool calls against your own API** (start session, update config, get status, stop session), executes them, and returns the outcome plus an audit trail of every tool call.

- We provide `homework/copilot-llm-stub.ts`: an `LlmProvider` interface and a `FakeLlmProvider` with canned responses — **no API key needed**. Build your agent loop against the interface.
- **Do not blindly execute provider output.** Like any real LLM, the provider can return invalid tool calls (out-of-range values, tools that don't exist). Validate every call before executing; reject bad ones with a `422` and a clear error per the contract — never a `500`.
- Wiring a real LLM (any provider) behind the same interface is a plus; we review using the stub path either way.
- What we look for: agent-loop clarity, validation before execution, graceful failure, audit-trail completeness, and tests covering the invalid-tool-call path.

## Rules of engagement

- Time expectation: **4–6 hours**. Submit within **5 days** of receiving this brief.
- If anything in the spec or contract looks contradictory or ambiguous, **do what you would do at work** — ask us (email is fine, we reply within a working day), or document the issue and your chosen interpretation in the README. Silently guessing is the only wrong move.
- Submit: Git repository link (GitHub/GitLab), README with one-command setup (Docker Compose for PostgreSQL preferred).


---

# Design & Architecture

## Tech design before code

Write a short design document (1–2 pages, `design.md` in your repo) and
**commit it before your first implementation commit** — we read git history.

It must cover:

- The timer's state machine: states, transitions, and which API call
  triggers each.
- Your database schema, with reasoning — why these tables/columns/
  constraints, and what alternatives you rejected.
- Error semantics: which requests can fail, with which status codes, and why.
- Contract feedback: if you owned `openapi.yaml`, what would you change in
  its next revision, and why? (Design critique only — implement the contract
  as-is either way, per the brief.)

Keep it engineering-lean: decisions and reasons, not prose. Bullets are fine.

## Server-authoritative timing & concurrency

The server, not the client, is the source of truth for remaining time.
In addition:

- The same user may have two clients open (e.g. two browser tabs).
  Concurrent commands against the same session (pause/resume/stop arriving
  near-simultaneously) must have **defined semantics** — no crashes, no
  corrupted state, no lost updates.
- Choose a strategy (e.g. optimistic locking returning `409 Conflict`, or a
  documented last-write-wins) and document it in `design.md`.
- Cover the concurrent path with at least one test.


---

# System-Level Design

## System boundary design

Assume the Pomodoro Timer is one module inside a larger productivity SaaS
platform that also includes task management, team boards and time tracking.

Add a section to your `design.md` that covers:

- Where the Timer module's boundary sits — what API surface does it expose
  to other modules, and what events (if any) does it publish or consume?
- Which data is owned by the Timer module and which would require
  cross-module queries or shared contracts?
- If the Timer needed to be extracted into a standalone service in the
  future, what does your current design already handle and what would need
  to change?

## Infrastructure & operations

Still assuming the Timer runs inside a production SaaS platform, add a
section to your `design.md` that covers:

- **Technology selection**: why you chose the database, cache, or message
  queue you did (or why you didn't need one). What trade-offs drove the
  decision?
- **Concurrency at scale**: if multiple service instances serve the same
  user, does your timer state need a distributed lock, optimistic locking,
  or something else? What breaks without it?
- **Deployment**: how would you deploy this service — containers,
  orchestration (e.g. Kubernetes), rolling updates? How do you handle a
  deploy while timers are actively counting down?
- **Observability**: what metrics, logs, or alerts would you set up so the
  team knows the Timer is healthy in production? What does "unhealthy" look
  like for a timer service?
- **Availability**: if the Timer service goes down, what is the user
  impact? What strategies (redundancy, graceful degradation, client-side
  fallback) would you consider, and which are worth the complexity?

You do not need to implement any of this — describe your reasoning and
trade-offs in `design.md`. Keep it engineering-lean: decisions and reasons,
not prose. Bullets and tables are fine.
