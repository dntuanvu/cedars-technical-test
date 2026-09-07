# Pomodoro Timer — Feature Spec

## User Story

As a user, I want a Pomodoro timer that manages my work and break intervals,
so that I can stay focused during work sessions and take regular breaks
without having to track the time myself.

## Background

The Pomodoro Technique alternates focused work intervals with short breaks,
inserting a longer break after a run of completed work intervals. This spec
describes the behavior the backend and frontend must implement together.
The API contract is the authoritative description of request/response
shapes — see the note at the end of this document.

## Acceptance Criteria

- [ ] A user can start a new work session.
- [ ] While a work or break interval is active, the remaining time counts
      down and is displayed as `mm:ss`.
- [ ] Pausing an active interval preserves the exact remaining seconds;
      resuming continues the countdown from that exact value (no drift,
      no rounding to the nearest minute).
- [ ] Stopping or resetting a session returns the timer to an idle state,
      with no active interval and no countdown running.
- [ ] When a work interval completes, a short break starts automatically
      without requiring user action.
- [ ] After every 4 completed work intervals, the next break is a long
      break instead of a short break. The long break replaces the short
      break on that cycle only; the pattern then repeats.
- [ ] When a break (short or long) completes, the next work interval
      starts automatically without requiring user action.
- [ ] The system tracks a cycle counter of completed work intervals per
      user, and this counter is available to the client.
- [ ] Each user can configure the durations (in minutes) of the work
      interval, the short break, and the long break independently.
- [ ] Timer state survives an API process restart — state must be
      persisted to durable storage, not held only in memory.

## Data

The system persists at least the following concepts:

- **Users** — the individuals using the timer.
- **Timer sessions** — the current (or most recent) run state for a user,
  including which interval is active, remaining time, and the count of
  completed work intervals in the current cycle.
- **Configurations** — per-user durations for work, short break, and long
  break intervals.

Exact schema design (tables/columns, relationships, indexing) is left to
the candidate and is part of what is graded.

## Out of Scope

- Multi-device sync or real-time push notifications.
- Team/shared timers (this spec covers a single user's timer).
- Historical analytics or reporting beyond the running cycle counter.

## Contract

The API contract (`openapi.yaml`) is the source of truth for all request
and response shapes. Where this document and the contract appear to
disagree on a detail, the contract governs implementation; note the
discrepancy in your submission notes.
