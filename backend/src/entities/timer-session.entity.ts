import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import type { Mode, RunState } from '../domain/types';

@Entity({ name: 'timer_sessions' })
@Check(`"mode" IN ('work', 'short_break', 'long_break', 'idle')`)
@Check(`"run_state" IN ('running', 'paused', 'idle')`)
@Check(`"remaining_seconds" >= 0`)
export class TimerSessionEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 64, unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  mode: Mode;

  @Column({ name: 'run_state', type: 'varchar', length: 16 })
  runState: RunState;

  @Column({ name: 'remaining_seconds', type: 'int' })
  remainingSeconds: number;

  @Column({ name: 'deadline_at', type: 'timestamptz', nullable: true })
  deadlineAt: Date | null;

  @Column({ type: 'int', default: 1 })
  version: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => UserEntity, (user) => user.session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
