export type Mode = 'work' | 'short_break' | 'long_break' | 'idle';

export type SessionStatus = {
  sessionId: string;
  userId: string;
  mode: Mode;
  remainingSeconds: number;
  completedCycles: number;
  cyclesUntilLongBreak: number;
};

export type TimerConfig = {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
};

export type ApiError = {
  code: string;
  message: string;
};

export type ToolCallAudit = {
  tool: string;
  arguments: Record<string, unknown>;
  status: 'executed' | 'rejected';
  detail: string;
};

export type CopilotResult = {
  message: string;
  toolCalls: ToolCallAudit[];
};

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    userId?: string;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.userId) {
    headers['X-User-Id'] = options.userId;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = (await res.json()) as T | ApiError;
  if (!res.ok) {
    const err = data as ApiError;
    throw Object.assign(new Error(err.message || res.statusText), {
      code: err.code,
      status: res.status,
    });
  }
  return data as T;
}

export const api = {
  startSession: (userId: string) =>
    request<SessionStatus>('/sessions', { method: 'POST', body: { userId } }),
  action: (userId: string, action: 'pause' | 'resume' | 'stop') =>
    request<SessionStatus>('/sessions/current', {
      method: 'PATCH',
      userId,
      body: { action },
    }),
  status: (userId: string) =>
    request<SessionStatus>('/sessions/current/status', { userId }),
  getConfig: (userId: string) =>
    request<TimerConfig>(`/users/${encodeURIComponent(userId)}/config`),
  putConfig: (userId: string, config: TimerConfig) =>
    request<TimerConfig>(`/users/${encodeURIComponent(userId)}/config`, {
      method: 'PUT',
      body: config,
    }),
  copilot: (userId: string, utterance: string) =>
    request<CopilotResult>('/copilot/commands', {
      method: 'POST',
      body: { userId, utterance },
    }),
};
