import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TimerConfigEntity } from './timer-config.entity';
import { TimerSessionEntity } from './timer-session.entity';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id: string;

  @Column({ name: 'completed_cycles', type: 'int', default: 0 })
  completedCycles: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => TimerConfigEntity, (config) => config.user)
  config?: TimerConfigEntity;

  @OneToOne(() => TimerSessionEntity, (session) => session.user)
  session?: TimerSessionEntity;
}
