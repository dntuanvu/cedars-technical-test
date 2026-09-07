import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimerModule } from './timer/timer.module';
import { UserEntity } from './entities/user.entity';
import { TimerConfigEntity } from './entities/timer-config.entity';
import { TimerSessionEntity } from './entities/timer-session.entity';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: Number(process.env.DATABASE_PORT ?? 5433),
      username: process.env.DATABASE_USER ?? 'pomodoro',
      password: process.env.DATABASE_PASSWORD ?? 'pomodoro',
      database: process.env.DATABASE_NAME ?? 'pomodoro',
      entities: [UserEntity, TimerConfigEntity, TimerSessionEntity],
      synchronize: true,
    }),
    TimerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
