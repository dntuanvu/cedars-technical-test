import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';
import type { SessionAction } from '../domain/types';

export class StartSessionRequest {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class SessionActionRequest {
  @IsIn(['pause', 'resume', 'stop'])
  action: SessionAction;
}

export class TimerConfigDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  workMinutes: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  shortBreakMinutes: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  longBreakMinutes: number;
}

export class CopilotCommandRequest {
  @IsString()
  @IsNotEmpty()
  utterance: string;

  @IsString()
  @IsNotEmpty()
  userId: string;
}
