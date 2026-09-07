# Schema

Matches `design.md`. TypeORM `synchronize: true` for local/homework; production would use migrations.

```sql
CREATE TABLE users (
  id               varchar(64) PRIMARY KEY,
  completed_cycles integer NOT NULL DEFAULT 0 CHECK (completed_cycles >= 0),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE timer_configs (
  user_id               varchar(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  work_minutes          numeric(6,2) NOT NULL CHECK (work_minutes > 0),
  short_break_minutes   numeric(6,2) NOT NULL CHECK (short_break_minutes > 0),
  long_break_minutes    numeric(6,2) NOT NULL CHECK (long_break_minutes > 0),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE timer_sessions (
  id                 uuid PRIMARY KEY,
  user_id            varchar(64) NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  mode               varchar(16) NOT NULL CHECK (mode IN ('work','short_break','long_break','idle')),
  run_state          varchar(16) NOT NULL CHECK (run_state IN ('running','paused','idle')),
  remaining_seconds  integer NOT NULL CHECK (remaining_seconds >= 0),
  deadline_at        timestamptz NULL,
  version            integer NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
```

Indexes: primary keys plus `timer_sessions.user_id` UNIQUE (current session lookup). No extra indexes — there is no listing or sweeper query.

`completed_cycles` lives on `users` so it survives stop and process restart. `deadline_at` is the source of truth while running; `remaining_seconds` is the source of truth while paused.
