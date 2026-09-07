import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '../domain/types';
import { mapDomainError } from '../common/errors';
import { TIMER, type TimerPort } from '../timer/timer.port';
import {
  FakeLlmProvider,
  type LlmProvider,
  type ToolCall,
} from './llm-provider';
import { bindUserId, COPILOT_TOOLS, validateToolCall, validateToolCalls } from './tools';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export type ToolCallAudit = {
  tool: string;
  arguments: Record<string, unknown>;
  status: 'executed' | 'rejected';
  detail: string;
};

export type CopilotCommandResult = {
  message: string;
  toolCalls: ToolCallAudit[];
};

@Injectable()
export class CopilotService {
  constructor(
    @Inject(TIMER) private readonly timer: TimerPort,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
  ) {}

  async run(utterance: string, userId: string): Promise<CopilotCommandResult> {
    const raw = await this.llm.generateToolCalls(utterance, COPILOT_TOOLS);
    const bound = raw.map((call) => bindUserId(call, userId));

    try {
      validateToolCalls(bound);
    } catch (err) {
      mapDomainError(err);
    }

    if (bound.length === 0) {
      return {
        message: `I could not interpret that command for ${userId}.`,
        toolCalls: [],
      };
    }

    const audits: ToolCallAudit[] = [];
    for (const call of bound) {
      audits.push(await this.execute(call, userId));
    }

    return {
      message: summarize(audits, userId),
      toolCalls: audits,
    };
  }

  private async execute(
    call: ToolCall,
    userId: string,
  ): Promise<ToolCallAudit> {
    const validated = validateToolCall(call);
    try {
      switch (validated.tool) {
        case 'updateConfig': {
          const config = await this.timer.patchConfig(
            userId,
            validated.configPatch ?? {},
          );
          return {
            tool: call.tool,
            arguments: call.arguments,
            status: 'executed',
            detail: `Updated config to workMinutes=${config.workMinutes}, shortBreakMinutes=${config.shortBreakMinutes}, longBreakMinutes=${config.longBreakMinutes}.`,
          };
        }
        case 'startSession': {
          const status = await this.timer.startSession(userId);
          return {
            tool: call.tool,
            arguments: call.arguments,
            status: 'executed',
            detail: `Session ${status.sessionId} started.`,
          };
        }
        case 'getStatus': {
          const status = await this.timer.getStatus(userId);
          return {
            tool: call.tool,
            arguments: call.arguments,
            status: 'executed',
            detail: `Mode ${status.mode}, ${status.remainingSeconds}s remaining.`,
          };
        }
        case 'stopSession': {
          const status = await this.timer.applyAction(userId, 'stop');
          return {
            tool: call.tool,
            arguments: call.arguments,
            status: 'executed',
            detail: `Session ${status.sessionId} stopped.`,
          };
        }
        default:
          throw new DomainError(
            'COPILOT_INVALID_TOOL_CALL',
            `Tool call '${call.tool}' is not a recognized tool.`,
          );
      }
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : 'Tool execution failed.';
      return {
        tool: call.tool,
        arguments: call.arguments,
        status: 'rejected',
        detail,
      };
    }
  }
}

function summarize(audits: ToolCallAudit[], userId: string): string {
  const started = audits.find(
    (a) => a.tool === 'startSession' && a.status === 'executed',
  );
  if (started) {
    return `Started a work session for ${userId}.`;
  }
  const executed = audits.filter((a) => a.status === 'executed');
  if (executed.length === 0) {
    return `No tools were executed for ${userId}.`;
  }
  return executed.map((a) => a.detail).join(' ');
}

export { FakeLlmProvider };
