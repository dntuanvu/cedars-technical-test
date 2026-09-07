import { DomainError } from '../domain/types';
import { assertValidDurationMinutes } from '../domain/timer.machine';
import type { TimerConfig } from '../domain/types';
import type { ToolCall, ToolDefinition } from './llm-provider';

export const COPILOT_TOOLS: ToolDefinition[] = [
  {
    name: 'updateConfig',
    description: 'Update one or more interval durations (minutes) for the user.',
    parameters: {
      type: 'object',
      properties: {
        workMinutes: { type: 'number' },
        shortBreakMinutes: { type: 'number' },
        longBreakMinutes: { type: 'number' },
      },
    },
  },
  {
    name: 'startSession',
    description: 'Start a new work session for the user.',
    parameters: { type: 'object', properties: { userId: { type: 'string' } } },
  },
  {
    name: 'getStatus',
    description: 'Read the current session status.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'stopSession',
    description: 'Stop the current session and return to idle.',
    parameters: { type: 'object', properties: {} },
  },
];

const ALLOWED = new Set(COPILOT_TOOLS.map((t) => t.name));

const PLACEHOLDER = '__PLACEHOLDER_USER_ID__';

export type BoundToolCall = {
  tool: string;
  arguments: Record<string, unknown>;
  configPatch?: Partial<TimerConfig>;
};

export function bindUserId(
  call: ToolCall,
  userId: string,
): ToolCall {
  const args = { ...call.arguments };
  if (args.userId === PLACEHOLDER || typeof args.userId === 'string') {
    args.userId = userId;
  }
  return { tool: call.tool, arguments: args };
}

export function validateToolCalls(calls: ToolCall[]): BoundToolCall[] {
  const unknown = calls.find((call) => !ALLOWED.has(call.tool));
  if (unknown) {
    throw new DomainError(
      'COPILOT_INVALID_TOOL_CALL',
      `Tool call '${unknown.tool}' is not a recognized tool.`,
    );
  }
  return calls.map((call) => validateToolCall(call));
}

export function validateToolCall(call: ToolCall): BoundToolCall {
  if (!ALLOWED.has(call.tool)) {
    throw new DomainError(
      'COPILOT_INVALID_TOOL_CALL',
      `Tool call '${call.tool}' is not a recognized tool.`,
    );
  }

  if (call.tool === 'updateConfig') {
    const patch: Partial<TimerConfig> = {};
    for (const key of [
      'workMinutes',
      'shortBreakMinutes',
      'longBreakMinutes',
    ] as const) {
      if (call.arguments[key] !== undefined) {
        const value = call.arguments[key];
        if (typeof value !== 'number') {
          throw new DomainError(
            'COPILOT_INVALID_TOOL_CALL',
            `Tool call 'updateConfig' argument '${key}' must be a number.`,
          );
        }
        try {
          assertValidDurationMinutes(value, key);
        } catch (err) {
          if (err instanceof DomainError) {
            throw new DomainError(
              'COPILOT_INVALID_TOOL_CALL',
              `Tool call 'updateConfig' has an out-of-range argument: ${err.message}`,
            );
          }
          throw err;
        }
        patch[key] = value;
      }
    }
    if (Object.keys(patch).length === 0) {
      throw new DomainError(
        'COPILOT_INVALID_TOOL_CALL',
        "Tool call 'updateConfig' requires at least one duration field.",
      );
    }
    return { tool: call.tool, arguments: call.arguments, configPatch: patch };
  }

  return { tool: call.tool, arguments: call.arguments };
}
