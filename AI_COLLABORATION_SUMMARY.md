# AI Collaboration Summary

## Overview

- Tool/model: Cursor Grok 4.6 via Cursor IDE agent.
- Total sessions: 1.
- Estimated total time: ~2 h 9 m, based on the logged session from
  2026-09-07 17:21 +08 to 19:30 +08.
- AI was used heavily for implementation acceleration. The candidate
  directed the workflow, reviewed the resulting solution through local
  execution and tests, identified runtime/environment failures, and
  iterated with the agent until the application worked end to end.

## Timeline

- **Session 1 — 2026-09-07 17:21 +08 → 19:30 +08**
  - Reviewed the supplied brief, feature spec, and OpenAPI contract.
  - Created and committed the technical design before implementation,
    as required by the assessment.
  - Implemented the NestJS/TypeORM/PostgreSQL backend, timer state
    machine, Copilot endpoint, React/Chakra UI frontend, Docker Compose,
    and automated tests with Cursor assistance.
  - Candidate ran the application locally and surfaced a Docker/npm
    compatibility issue.
  - Iterated on the Docker setup and verified the complete stack after
    the fix.
  - Retried GitHub submission after a temporary port-443 connectivity
    failure.
  - Generated the final collaboration summary after local verification.

## Division of labor

### Candidate

- Chose Cursor as the AI development tool and directed the implementation
  workflow around the supplied Cedars requirements.
- Required the design document to be completed and committed before
  application implementation.
- Used the supplied brief/spec/OpenAPI as the acceptance criteria for the
  implementation and retained explicit documentation of contract
  ambiguities rather than silently hiding them.
- Ran the complete solution locally and verified the application rather
  than relying only on generated code.
- Identified the Docker build failure caused by the npm/lockfile mismatch
  during local execution and asked the agent to investigate and correct it.
- Re-ran the Docker Compose stack after the fix and confirmed the application
  was working.
- Verified key API and UI flows through the test suite and manual execution.
- Reviewed and accepted the final implementation and documentation for
  submission.

### AI / Cursor

- Proposed the initial architecture and generated the first drafts of
  `design.md`, backend implementation, frontend implementation, tests,
  Docker configuration, schema documentation, and supporting README files.
- Implemented the server-authoritative timer state machine and PostgreSQL
  concurrency strategy.
- Implemented the Copilot provider/tool validation path and automated tests.
- Diagnosed and corrected the Docker/npm compatibility issue after the
  candidate reproduced it locally.
- Maintained `ai-session-log.md` and generated this summary from the recorded
  session.

### Collaboration model

Cursor was used primarily as an implementation and reasoning accelerator.
The candidate remained responsible for deciding when the solution was
acceptable for submission by executing it locally, checking requirements,
surfacing failures, requesting corrections, and validating the final
behaviour.

Two contract ambiguities were explicitly documented rather than hidden:

1. The feature spec specifies a long break every 4 completed work intervals,
   while the OpenAPI description refers to 3.
2. The current-session GET/PATCH routes do not contain a user identifier.

The submitted implementation uses the interpretations documented in
`design.md`.

## AI mistakes & corrections

- **Docker/npm lockfile incompatibility**
  - Initial Dockerfiles used `npm ci`.
  - During candidate testing, the build failed because the Node 22 Alpine
    image/npm version did not accept the generated lockfile dependency state.
  - The candidate surfaced the failure through an actual
    `docker compose up --build` run.
  - Cursor investigated and changed the Docker installation step to
    `npm install --no-audit --no-fund`.
  - The stack was rebuilt and verified afterward.

- **GitHub connectivity issue**
  - A push initially failed with
    `Failed to connect to github.com port 443`.
  - This was identified as a transient connectivity problem rather than an
    application defect.
  - The push was retried successfully.

## Verification

- Backend unit tests: 18 passed.
  - Timer state-machine behaviour.
  - Copilot validation.
  - Invalid provider tool call returns 422 without side effects.

- Backend e2e tests: 7 passed.
  - Start / pause / resume / stop lifecycle.
  - Duplicate active-session conflict.
  - Configuration read/update.
  - Copilot success and invalid-call handling.
  - Concurrent pause/stop path against PostgreSQL.

- Manual verification:
  - `docker compose up --build`
  - API `/health`
  - Session start and countdown
  - Pause/resume behaviour
  - Duplicate start → 409
  - Copilot invalid call → 422
  - Vite frontend and API proxy
  - Config API access

- Candidate confirmed the full application worked locally before submission.

- Contract review:
  - OpenAPI request/response field names and primary status codes were followed.
  - Known spec/contract inconsistencies were explicitly documented in
    `design.md` rather than silently resolved.
