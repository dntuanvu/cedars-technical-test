import {
  DEFAULT_CONFIG,
  DomainError,
  LONG_BREAK_EVERY,
  type Mode,
  type TimerConfig,
  type TimerSnapshot,
} from './types';

export function cyclesUntilLongBreak(completedCycles: number): number {
  const remainder = completedCycles % LONG_BREAK_EVERY;
  return remainder === 0 ? LONG_BREAK_EVERY : LONG_BREAK_EVERY - remainder;
}

export function minutesToSeconds(minutes: number): number {
  return Math.round(minutes * 60);
}

export function assertValidDurationMinutes(minutes: number, field: string): void {
  if (typeof minutes !== 'number' || Number.isNaN(minutes) || minutes <= 0) {
    throw new DomainError(
      'VALIDATION_ERROR',
      `${field} must be a number greater than 0.`,
    );
  }
  if (minutesToSeconds(minutes) < 1) {
    throw new DomainError(
      'VALIDATION_ERROR',
      `${field} is too small; it must be at least one second.`,
    );
  }
}

export function assertValidConfig(config: TimerConfig): void {
  assertValidDurationMinutes(config.workMinutes, 'workMinutes');
  assertValidDurationMinutes(config.shortBreakMinutes, 'shortBreakMinutes');
  assertValidDurationMinutes(config.longBreakMinutes, 'longBreakMinutes');
}

export function durationSecondsFor(mode: Mode, config: TimerConfig): number {
  switch (mode) {
    case 'work':
      return minutesToSeconds(config.workMinutes);
    case 'short_break':
      return minutesToSeconds(config.shortBreakMinutes);
    case 'long_break':
      return minutesToSeconds(config.longBreakMinutes);
    case 'idle':
      return 0;
  }
}

export function remainingSecondsNow(snapshot: TimerSnapshot, now: Date): number {
  if (snapshot.runState !== 'running' || !snapshot.deadlineAt) {
    return Math.max(0, snapshot.remainingSeconds);
  }
  return Math.max(
    0,
    Math.floor((snapshot.deadlineAt.getTime() - now.getTime()) / 1000),
  );
}

function beginInterval(
  snapshot: TimerSnapshot,
  mode: Mode,
  config: TimerConfig,
  startedAt: Date,
): TimerSnapshot {
  const remainingSeconds = durationSecondsFor(mode, config);
  return {
    ...snapshot,
    mode,
    runState: 'running',
    remainingSeconds,
    deadlineAt: new Date(startedAt.getTime() + remainingSeconds * 1000),
  };
}

function completeCurrentInterval(
  snapshot: TimerSnapshot,
  config: TimerConfig,
  completedAt: Date,
): TimerSnapshot {
  if (snapshot.mode === 'idle') {
    return snapshot;
  }
  if (snapshot.mode === 'work') {
    const completedCycles = snapshot.completedCycles + 1;
    const nextMode: Mode =
      completedCycles % LONG_BREAK_EVERY === 0 ? 'long_break' : 'short_break';
    return beginInterval(
      { ...snapshot, completedCycles },
      nextMode,
      config,
      completedAt,
    );
  }
  return beginInterval(snapshot, 'work', config, completedAt);
}

/** Apply elapsed wall-clock time; may complete several intervals. */
export function materialize(
  snapshot: TimerSnapshot,
  config: TimerConfig,
  now: Date,
): TimerSnapshot {
  if (snapshot.mode === 'idle' || snapshot.runState !== 'running') {
    return snapshot;
  }
  let current = snapshot;
  let guard = 0;
  while (
    current.runState === 'running' &&
    current.deadlineAt &&
    current.deadlineAt.getTime() <= now.getTime()
  ) {
    current = completeCurrentInterval(current, config, current.deadlineAt);
    guard += 1;
    if (guard > 10_000) {
      throw new Error('Timer materialize loop exceeded safety bound');
    }
  }
  return current;
}

function requireActive(
  snapshot: TimerSnapshot | null,
  config: TimerConfig,
  now: Date,
): TimerSnapshot {
  if (!snapshot || snapshot.mode === 'idle') {
    throw new DomainError(
      'NO_ACTIVE_SESSION',
      'No active session was found for this user.',
    );
  }
  return materialize(snapshot, config, now);
}

export function startWork(params: {
  existing: TimerSnapshot | null;
  userId: string;
  sessionId: string;
  config: TimerConfig;
  now: Date;
}): TimerSnapshot {
  const completedCycles = params.existing?.completedCycles ?? 0;
  if (params.existing) {
    const current = materialize(params.existing, params.config, params.now);
    if (current.mode !== 'idle') {
      throw new DomainError(
        'SESSION_ALREADY_ACTIVE',
        'A session is already active for this user.',
      );
    }
  }
  return beginInterval(
    {
      sessionId: params.sessionId,
      userId: params.userId,
      mode: 'idle',
      runState: 'idle',
      remainingSeconds: 0,
      deadlineAt: null,
      completedCycles,
    },
    'work',
    params.config,
    params.now,
  );
}

export function pause(
  snapshot: TimerSnapshot | null,
  config: TimerConfig,
  now: Date,
): TimerSnapshot {
  const current = requireActive(snapshot, config, now);
  if (current.runState === 'paused') {
    return current;
  }
  return {
    ...current,
    runState: 'paused',
    remainingSeconds: remainingSecondsNow(current, now),
    deadlineAt: null,
  };
}

export function resume(
  snapshot: TimerSnapshot | null,
  config: TimerConfig,
  now: Date,
): TimerSnapshot {
  const current = requireActive(snapshot, config, now);
  if (current.runState === 'running') {
    return current;
  }
  const remainingSeconds = remainingSecondsNow(current, now);
  return {
    ...current,
    runState: 'running',
    remainingSeconds,
    deadlineAt: new Date(now.getTime() + remainingSeconds * 1000),
  };
}

export function stop(
  snapshot: TimerSnapshot | null,
  config: TimerConfig,
  now: Date,
): TimerSnapshot {
  const current = requireActive(snapshot, config, now);
  return {
    ...current,
    mode: 'idle',
    runState: 'idle',
    remainingSeconds: 0,
    deadlineAt: null,
  };
}

export function mergeConfig(
  current: TimerConfig,
  patch: Partial<TimerConfig>,
): TimerConfig {
  const next = { ...current, ...patch };
  assertValidConfig(next);
  return next;
}

export function toStatus(snapshot: TimerSnapshot, now: Date) {
  return {
    sessionId: snapshot.sessionId,
    userId: snapshot.userId,
    mode: snapshot.mode,
    remainingSeconds: remainingSecondsNow(snapshot, now),
    completedCycles: snapshot.completedCycles,
    cyclesUntilLongBreak: cyclesUntilLongBreak(snapshot.completedCycles),
  };
}

export { DEFAULT_CONFIG };
