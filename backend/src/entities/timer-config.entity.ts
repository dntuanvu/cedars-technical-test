import {
  Check,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../common/numeric.transformer';
import { UserEntity } from './user.entity';

@Entity({ name: 'timer_configs' })
@Check(`"work_minutes" > 0`)
@Check(`"short_break_minutes" > 0`)
@Check(`"long_break_minutes" > 0`)
export class TimerConfigEntity {
  @PrimaryColumn({ name: 'user_id', type: 'varchar', length: 64 })
  userId: string;

  @Column({
    name: 'work_minutes',
    type: 'numeric',
    precision: 6,
    scale: 2,
    transformer: numericTransformer,
  })
  workMinutes: number;

  @Column({
    name: 'short_break_minutes',
    type: 'numeric',
    precision: 6,
    scale: 2,
    transformer: numericTransformer,
  })
  shortBreakMinutes: number;

  @Column({
    name: 'long_break_minutes',
    type: 'numeric',
    precision: 6,
    scale: 2,
    transformer: numericTransformer,
  })
  longBreakMinutes: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => UserEntity, (user) => user.config, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
