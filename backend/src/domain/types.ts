export type Mode = 'work' | 'short_break' | 'long_break' | 'idle';
export type RunState = 'running' | 'paused' | 'idle';
export type SessionAction = 'pause' | 'resume' | 'stop';

export type TimerConfig = {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
};

export type TimerSnapshot = {
  sessionId: string;
  userId: string;
  mode: Mode;
  runState: RunState;
  remainingSeconds: number;
  deadlineAt: Date | null;
  completedCycles: number;
};

export const LONG_BREAK_EVERY = 4;

export const DEFAULT_CONFIG: TimerConfig = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
};

export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
