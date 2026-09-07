/**
 * Provided homework stub (homework/copilot-llm-stub.ts), vendored so the
 * backend can import it without a cross-package path.
 */
export type ToolCall = {
  tool: string;
  arguments: Record<string, unknown>;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export interface LlmProvider {
  generateToolCalls(
    utterance: string,
    tools: ToolDefinition[],
  ): Promise<ToolCall[]>;
}

function cloneToolCalls(calls: ToolCall[]): ToolCall[] {
  return calls.map((call) => ({
    tool: call.tool,
    arguments: { ...call.arguments },
  }));
}

export class FakeLlmProvider implements LlmProvider {
  async generateToolCalls(
    utterance: string,
    _tools: ToolDefinition[],
  ): Promise<ToolCall[]> {
    const text = utterance.toLowerCase();

    if (text.includes('deep work') || text.includes('50-minute')) {
      return cloneToolCalls([
        { tool: 'updateConfig', arguments: { workMinutes: 50 } },
        {
          tool: 'startSession',
          arguments: { userId: '__PLACEHOLDER_USER_ID__' },
        },
      ]);
    }

    if (text.includes('start')) {
      return cloneToolCalls([
        {
          tool: 'startSession',
          arguments: { userId: '__PLACEHOLDER_USER_ID__' },
        },
      ]);
    }

    if (text.includes('status') || text.includes('how much time')) {
      return cloneToolCalls([{ tool: 'getStatus', arguments: {} }]);
    }

    if (text.includes('stop') || text.includes('cancel')) {
      return cloneToolCalls([{ tool: 'stopSession', arguments: {} }]);
    }

    if (text.includes('reset my settings')) {
      return cloneToolCalls([
        {
          tool: 'updateConfig',
          arguments: {
            workMinutes: -10,
            shortBreakMinutes: 5,
            longBreakMinutes: 15,
          },
        },
        { tool: 'deleteAllSessions', arguments: {} },
      ]);
    }

    return [];
  }
}
