/**
 * copilot-llm-stub.ts
 *
 * A zero-API-key stand-in for a real LLM tool-calling provider. Drop this
 * file into your project and wire it behind the same `LlmProvider`
 * interface a real provider (OpenAI, Anthropic, etc.) would implement.
 *
 * Note: like any real LLM, this provider can return invalid tool calls.
 * Your agent is responsible for validating every tool call before
 * executing it.
 */

/** A single tool invocation the model wants the agent to perform. */
export type ToolCall = {
  tool: string;
  arguments: Record<string, unknown>;
};

/** JSON-schema-ish description of a tool the model is allowed to call. */
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

/** Anything that turns a natural-language utterance into tool calls. */
export interface LlmProvider {
  generateToolCalls(
    utterance: string,
    tools: ToolDefinition[],
  ): Promise<ToolCall[]>;
}

/**
 * Deep-copies a canned array of tool calls so callers can freely mutate
 * the result without corrupting the next invocation's canned data.
 */
function cloneToolCalls(calls: ToolCall[]): ToolCall[] {
  return calls.map((call) => ({
    tool: call.tool,
    arguments: { ...call.arguments },
  }));
}

/**
 * Keyword-matches the utterance against a handful of canned scenarios and
 * returns deep copies of pre-baked tool calls. `tools` is accepted (to
 * satisfy the `LlmProvider` interface, and so a real implementation could
 * use it to constrain output) but this stub ignores it.
 */
export class FakeLlmProvider implements LlmProvider {
  async generateToolCalls(
    utterance: string,
    _tools: ToolDefinition[],
  ): Promise<ToolCall[]> {
    const text = utterance.toLowerCase();

    // Scenario 1: a longer, specific work session — configure then start.
    // Matches utterances like "Start a 50-minute deep work session".
    if (text.includes("deep work") || text.includes("50-minute")) {
      return cloneToolCalls([
        { tool: "updateConfig", arguments: { workMinutes: 50 } },
        { tool: "startSession", arguments: { userId: "__PLACEHOLDER_USER_ID__" } },
      ]);
    }

    // Scenario 2: a bare request to begin working.
    // Matches utterances like "start a session" / "start the timer".
    if (text.includes("start")) {
      return cloneToolCalls([
        { tool: "startSession", arguments: { userId: "__PLACEHOLDER_USER_ID__" } },
      ]);
    }

    // Scenario 3: asking how the current session is doing.
    // Matches utterances like "what's my status" / "how much time is left".
    if (text.includes("status") || text.includes("how much time")) {
      return cloneToolCalls([{ tool: "getStatus", arguments: {} }]);
    }

    // Scenario 4: ending the current session early.
    // Matches utterances like "stop" / "cancel my session".
    if (text.includes("stop") || text.includes("cancel")) {
      return cloneToolCalls([{ tool: "stopSession", arguments: {} }]);
    }

    // Scenario 5: a request to restore default settings.
    // Matches utterances like "reset my settings".
    if (text.includes("reset my settings")) {
      return cloneToolCalls([
        {
          tool: "updateConfig",
          arguments: {
            workMinutes: -10,
            shortBreakMinutes: 5,
            longBreakMinutes: 15,
          },
        },
        { tool: "deleteAllSessions", arguments: {} },
      ]);
    }

    // No scenario matched: the provider produced nothing. Callers must
    // handle an empty array as a valid (if unhelpful) response.
    return [];
  }
}
