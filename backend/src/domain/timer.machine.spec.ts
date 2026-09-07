import {
  DEFAULT_CONFIG,
  DomainError,
  LONG_BREAK_EVERY,
  type TimerSnapshot,
} from './types';
import {
  cyclesUntilLongBreak,
  materialize,
  minutesToSeconds,
  pause,
  remainingSecondsNow,
  resume,
  startWork,
  stop,
  toStatus,
} from './timer.machine';

const NOW = new Date('2026-09-07T09:00:00.000Z');

function started(overrides: Partial<TimerSnapshot> = {}): TimerSnapshot {
  return startWork({
    existing: null,
    userId: 'u_123',
    sessionId: 's_1',
    config: DEFAULT_CONFIG,
    now: NOW,
  });
}

describe('cyclesUntilLongBreak', () => {
  it('uses a 4-work cycle and maps multiples of 4 to 4', () => {
    expect(cyclesUntilLongBreak(0)).toBe(4);
    expect(cyclesUntilLongBreak(1)).toBe(3);
    expect(cyclesUntilLongBreak(2)).toBe(2);
    expect(cyclesUntilLongBreak(3)).toBe(1);
    expect(cyclesUntilLongBreak(4)).toBe(4);
    expect(cyclesUntilLongBreak(7)).toBe(1);
  });
});

describe('startWork', () => {
  it('starts a running work interval from idle', () => {
    const snap = started();
    expect(snap.mode).toBe('work');
    expect(snap.runState).toBe('running');
    expect(snap.remainingSeconds).toBe(minutesToSeconds(25));
    expect(snap.deadlineAt).toEqual(
      new Date(NOW.getTime() + 25 * 60 * 1000),
    );
  });

  it('rejects start when a session is already active', () => {
    expect(() =>
      startWork({
        existing: started(),
        userId: 'u_123',
        sessionId: 's_2',
        config: DEFAULT_CONFIG,
        now: NOW,
      }),
    ).toThrow(DomainError);
    try {
      startWork({
        existing: started(),
        userId: 'u_123',
        sessionId: 's_2',
        config: DEFAULT_CONFIG,
        now: NOW,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('SESSION_ALREADY_ACTIVE');
    }
  });

  it('allows start after stop and preserves completedCycles', () => {
    const afterStop = stop(started(), DEFAULT_CONFIG, NOW);
    afterStop.completedCycles = 2;
    const next = startWork({
      existing: afterStop,
      userId: 'u_123',
      sessionId: 's_2',
      config: DEFAULT_CONFIG,
      now: NOW,
    });
    expect(next.sessionId).toBe('s_2');
    expect(next.mode).toBe('work');
    expect(next.completedCycles).toBe(2);
  });
});

describe('pause / resume', () => {
  it('freezes remaining seconds and resumes from that exact value', () => {
    const running = started();
    const plus90 = new Date(NOW.getTime() + 90_000);
    const paused = pause(running, DEFAULT_CONFIG, plus90);
    expect(paused.runState).toBe('paused');
    expect(paused.deadlineAt).toBeNull();
    expect(paused.remainingSeconds).toBe(25 * 60 - 90);

    const later = new Date(plus90.getTime() + 60_000);
    expect(remainingSecondsNow(paused, later)).toBe(25 * 60 - 90);

    const resumed = resume(paused, DEFAULT_CONFIG, later);
    expect(resumed.runState).toBe('running');
    expect(remainingSecondsNow(resumed, later)).toBe(25 * 60 - 90);
    expect(remainingSecondsNow(resumed, new Date(later.getTime() + 10_000))).toBe(
      25 * 60 - 100,
    );
  });

  it('is idempotent when already paused or already running', () => {
    const paused = pause(started(), DEFAULT_CONFIG, NOW);
    const pausedAgain = pause(paused, DEFAULT_CONFIG, NOW);
    expect(pausedAgain.runState).toBe('paused');
    const running = resume(paused, DEFAULT_CONFIG, NOW);
    expect(resume(running, DEFAULT_CONFIG, NOW).runState).toBe('running');
  });

  it('does not round remaining time to the nearest minute', () => {
    const plus13 = new Date(NOW.getTime() + 13_000);
    const paused = pause(started(), DEFAULT_CONFIG, plus13);
    expect(paused.remainingSeconds).toBe(25 * 60 - 13);
  });
});

describe('stop', () => {
  it('returns idle with remaining 0 and keeps completedCycles', () => {
    const snap = started();
    snap.completedCycles = 3;
    const stopped = stop(snap, DEFAULT_CONFIG, NOW);
    expect(stopped.mode).toBe('idle');
    expect(stopped.runState).toBe('idle');
    expect(stopped.remainingSeconds).toBe(0);
    expect(stopped.completedCycles).toBe(3);
  });

  it('throws NO_ACTIVE_SESSION when idle', () => {
    const stopped = stop(started(), DEFAULT_CONFIG, NOW);
    expect(() => pause(stopped, DEFAULT_CONFIG, NOW)).toThrow(DomainError);
    try {
      stop(stopped, DEFAULT_CONFIG, NOW);
    } catch (err) {
      expect((err as DomainError).code).toBe('NO_ACTIVE_SESSION');
    }
  });
});

describe('auto-transitions', () => {
  const shortBreak = minutesToSeconds(DEFAULT_CONFIG.shortBreakMinutes);
  const longBreak = minutesToSeconds(DEFAULT_CONFIG.longBreakMinutes);
  const work = minutesToSeconds(DEFAULT_CONFIG.workMinutes);

  it('starts a short break when a work interval completes', () => {
    const afterWork = materialize(
      started(),
      DEFAULT_CONFIG,
      new Date(NOW.getTime() + work * 1000),
    );
    expect(afterWork.mode).toBe('short_break');
    expect(afterWork.completedCycles).toBe(1);
    expect(afterWork.remainingSeconds).toBe(shortBreak);
  });

  it('starts work again when a short break completes', () => {
    const afterBreak = materialize(
      started(),
      DEFAULT_CONFIG,
      new Date(NOW.getTime() + (work + shortBreak) * 1000),
    );
    expect(afterBreak.mode).toBe('work');
    expect(afterBreak.completedCycles).toBe(1);
  });

  it('uses a long break after every 4 completed work intervals', () => {
    const oneCycle =
      4 * work + 3 * shortBreak;
    const afterFourthWork = materialize(
      started(),
      DEFAULT_CONFIG,
      new Date(NOW.getTime() + oneCycle * 1000),
    );
    expect(afterFourthWork.mode).toBe('long_break');
    expect(afterFourthWork.completedCycles).toBe(4);
    expect(afterFourthWork.remainingSeconds).toBe(longBreak);
    expect(LONG_BREAK_EVERY).toBe(4);
  });

  it('replays multiple skipped intervals from a persisted deadline', () => {
    const elapsed = work + shortBreak + 30;
    const current = materialize(
      started(),
      DEFAULT_CONFIG,
      new Date(NOW.getTime() + elapsed * 1000),
    );
    expect(current.mode).toBe('work');
    expect(current.completedCycles).toBe(1);
    expect(remainingSecondsNow(current, new Date(NOW.getTime() + elapsed * 1000))).toBe(
      work - 30,
    );
  });

  it('does not rewrite an in-flight deadline when config changes', () => {
    const running = started();
    const shortConfig = {
      workMinutes: 1,
      shortBreakMinutes: 1,
      longBreakMinutes: 1,
    };
    const plus10 = new Date(NOW.getTime() + 10_000);
    expect(remainingSecondsNow(running, plus10)).toBe(work - 10);
    const stillLong = materialize(running, shortConfig, plus10);
    expect(stillLong.mode).toBe('work');
    expect(remainingSecondsNow(stillLong, plus10)).toBe(work - 10);
  });
});

describe('toStatus', () => {
  it('exposes live remaining seconds and cycle counters', () => {
    const plus5 = new Date(NOW.getTime() + 5_000);
    const status = toStatus(started(), plus5);
    expect(status).toMatchObject({
      sessionId: 's_1',
      userId: 'u_123',
      mode: 'work',
      remainingSeconds: 25 * 60 - 5,
      completedCycles: 0,
      cyclesUntilLongBreak: 4,
    });
  });
});
