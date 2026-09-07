import type { TimerSnapshot } from '../domain/types';

export type SessionStatusDto = {
  sessionId: string;
  userId: string;
  mode: TimerSnapshot['mode'];
  remainingSeconds: number;
  completedCycles: number;
  cyclesUntilLongBreak: number;
};
