import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { AppError, mapDomainError } from '../common/errors';
import { CLOCK, type Clock } from '../common/clock';
import {
  DEFAULT_CONFIG,
  pause,
  remainingSecondsNow,
  resume,
  startWork,
  stop,
  toStatus,
  mergeConfig,
  materialize,
  assertValidConfig,
} from '../domain/timer.machine';
import type { SessionAction, TimerConfig, TimerSnapshot } from '../domain/types';
import { UserEntity } from '../entities/user.entity';
import { TimerConfigEntity } from '../entities/timer-config.entity';
import { TimerSessionEntity } from '../entities/timer-session.entity';
import type { SessionStatusDto } from './timer.types';
import type { TimerPort } from './timer.port';

type LoadedContext = {
  user: UserEntity;
  config: TimerConfigEntity;
  session: TimerSessionEntity | null;
};

@Injectable()
export class TimerService implements TimerPort {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async getConfig(userId: string): Promise<TimerConfig> {
    return this.dataSource.transaction(async (manager) => {
      const { config } = await this.loadLocked(manager, userId);
      return this.toConfig(config);
    });
  }

  async updateConfig(userId: string, body: TimerConfig): Promise<TimerConfig> {
    try {
      assertValidConfig(body);
    } catch (err) {
      mapDomainError(err);
    }
    return this.dataSource.transaction(async (manager) => {
      const { config } = await this.loadLocked(manager, userId);
      config.workMinutes = body.workMinutes;
      config.shortBreakMinutes = body.shortBreakMinutes;
      config.longBreakMinutes = body.longBreakMinutes;
      await manager.save(config);
      return this.toConfig(config);
    });
  }

  async patchConfig(
    userId: string,
    patch: Partial<TimerConfig>,
  ): Promise<TimerConfig> {
    return this.dataSource.transaction(async (manager) => {
      const { config } = await this.loadLocked(manager, userId);
      try {
        const next = mergeConfig(this.toConfig(config), patch);
        config.workMinutes = next.workMinutes;
        config.shortBreakMinutes = next.shortBreakMinutes;
        config.longBreakMinutes = next.longBreakMinutes;
        await manager.save(config);
        return next;
      } catch (err) {
        mapDomainError(err);
      }
    });
  }

  async startSession(userId: string): Promise<SessionStatusDto> {
    return this.dataSource.transaction(async (manager) => {
      const ctx = await this.loadLocked(manager, userId);
      const now = this.clock.now();
      try {
        const next = startWork({
          existing: this.toSnapshot(ctx),
          userId,
          sessionId: randomUUID(),
          config: this.toConfig(ctx.config),
          now,
        });
        await this.persistSnapshot(manager, ctx, next, now);
        return toStatus(next, now);
      } catch (err) {
        mapDomainError(err);
      }
    });
  }

  async getStatus(userId: string): Promise<SessionStatusDto> {
    return this.dataSource.transaction(async (manager) => {
      const ctx = await this.loadLocked(manager, userId);
      const now = this.clock.now();
      const snapshot = this.requireActive(ctx, now);
      await this.persistSnapshot(manager, ctx, snapshot, now);
      return toStatus(snapshot, now);
    });
  }

  async applyAction(
    userId: string,
    action: SessionAction,
  ): Promise<SessionStatusDto> {
    return this.dataSource.transaction(async (manager) => {
      const ctx = await this.loadLocked(manager, userId);
      const now = this.clock.now();
      const config = this.toConfig(ctx.config);
      const existing = this.toSnapshot(ctx);
      try {
        let next: TimerSnapshot;
        switch (action) {
          case 'pause':
            next = pause(existing, config, now);
            break;
          case 'resume':
            next = resume(existing, config, now);
            break;
          case 'stop':
            next = stop(existing, config, now);
            break;
        }
        await this.persistSnapshot(manager, ctx, next, now);
        return toStatus(next, now);
      } catch (err) {
        mapDomainError(err);
      }
    });
  }

  private requireActive(ctx: LoadedContext, now: Date): TimerSnapshot {
    const snapshot = this.toSnapshot(ctx);
    if (!snapshot || snapshot.mode === 'idle') {
      throw new AppError(
        404,
        'NO_ACTIVE_SESSION',
        'No active session was found for this user.',
      );
    }
    return materialize(snapshot, this.toConfig(ctx.config), now);
  }

  private async loadLocked(
    manager: EntityManager,
    userId: string,
  ): Promise<LoadedContext> {
    const user = await this.ensureUser(manager, userId);
    const config = await this.ensureConfig(manager, userId);
    const session = await manager.findOne(TimerSessionEntity, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    return { user, config, session };
  }

  private async ensureUser(
    manager: EntityManager,
    userId: string,
  ): Promise<UserEntity> {
    let user = await manager.findOne(UserEntity, {
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) {
      try {
        await manager.save(UserEntity, { id: userId, completedCycles: 0 });
      } catch {
        // concurrent insert — unique id
      }
      user = await manager.findOne(UserEntity, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
    }
    if (!user) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load user row.');
    }
    return user;
  }

  private async ensureConfig(
    manager: EntityManager,
    userId: string,
  ): Promise<TimerConfigEntity> {
    let config = await manager.findOne(TimerConfigEntity, {
      where: { userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!config) {
      try {
        await manager.save(TimerConfigEntity, {
          userId,
          ...DEFAULT_CONFIG,
        });
      } catch {
        // concurrent insert — unique user_id
      }
      config = await manager.findOne(TimerConfigEntity, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
    }
    if (!config) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load timer config.');
    }
    return config;
  }

  private toConfig(entity: TimerConfigEntity): TimerConfig {
    return {
      workMinutes: Number(entity.workMinutes),
      shortBreakMinutes: Number(entity.shortBreakMinutes),
      longBreakMinutes: Number(entity.longBreakMinutes),
    };
  }

  private toSnapshot(ctx: LoadedContext): TimerSnapshot {
    if (!ctx.session) {
      return {
        sessionId: 'none',
        userId: ctx.user.id,
        mode: 'idle',
        runState: 'idle',
        remainingSeconds: 0,
        deadlineAt: null,
        completedCycles: ctx.user.completedCycles,
      };
    }
    return {
      sessionId: ctx.session.id,
      userId: ctx.session.userId,
      mode: ctx.session.mode,
      runState: ctx.session.runState,
      remainingSeconds: ctx.session.remainingSeconds,
      deadlineAt: ctx.session.deadlineAt,
      completedCycles: ctx.user.completedCycles,
    };
  }

  private async persistSnapshot(
    manager: EntityManager,
    ctx: LoadedContext,
    snapshot: TimerSnapshot,
    now: Date,
  ): Promise<void> {
    ctx.user.completedCycles = snapshot.completedCycles;
    await manager.save(ctx.user);

    if (!ctx.session) {
      ctx.session = manager.create(TimerSessionEntity, {
        id: snapshot.sessionId,
        userId: snapshot.userId,
        version: 0,
      });
    } else if (ctx.session.id !== snapshot.sessionId) {
      await manager.remove(ctx.session);
      ctx.session = manager.create(TimerSessionEntity, {
        id: snapshot.sessionId,
        userId: snapshot.userId,
        version: 0,
      });
    }

    ctx.session.mode = snapshot.mode;
    ctx.session.runState = snapshot.runState;
    ctx.session.remainingSeconds = remainingSecondsNow(snapshot, now);
    ctx.session.deadlineAt = snapshot.deadlineAt;
    ctx.session.version = (ctx.session.version ?? 0) + 1;
    await manager.save(ctx.session);
  }
}
