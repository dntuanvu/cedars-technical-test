import type { TimerConfig } from '../domain/types';
import type { SessionAction } from '../domain/types';
import type { SessionStatusDto } from './timer.types';

export const TIMER = Symbol('TIMER');

export interface TimerPort {
  getConfig(userId: string): Promise<TimerConfig>;
  updateConfig(userId: string, body: TimerConfig): Promise<TimerConfig>;
  patchConfig(userId: string, patch: Partial<TimerConfig>): Promise<TimerConfig>;
  startSession(userId: string): Promise<SessionStatusDto>;
  getStatus(userId: string): Promise<SessionStatusDto>;
  applyAction(userId: string, action: SessionAction): Promise<SessionStatusDto>;
}
