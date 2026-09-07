import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CLOCK, SystemClock } from '../common/clock';
import { UserEntity } from '../entities/user.entity';
import { TimerConfigEntity } from '../entities/timer-config.entity';
import { TimerSessionEntity } from '../entities/timer-session.entity';
import { TimerService } from './timer.service';
import { SessionsController } from './sessions.controller';
import { ConfigController } from './config.controller';
import { CopilotController } from '../copilot/copilot.controller';
import { CopilotService, LLM_PROVIDER } from '../copilot/copilot.service';
import { FakeLlmProvider } from '../copilot/llm-provider';
import { TIMER } from './timer.port';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, TimerConfigEntity, TimerSessionEntity]),
  ],
  controllers: [SessionsController, ConfigController, CopilotController],
  providers: [
    TimerService,
    { provide: TIMER, useExisting: TimerService },
    CopilotService,
    { provide: CLOCK, useClass: SystemClock },
    { provide: LLM_PROVIDER, useClass: FakeLlmProvider },
  ],
})
export class TimerModule {}
