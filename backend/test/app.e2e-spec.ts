import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { join } from 'path';

const PORT = process.env.E2E_PORT ?? '3456';
const BASE = `http://127.0.0.1:${PORT}`;

function api(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, init);
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function waitForHealth(timeoutMs = 20_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await api('/health');
      if (res.ok) {
        return;
      }
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('API did not become healthy in time');
}

describe('Pomodoro API (e2e)', () => {
  let child: ChildProcessWithoutNullStreams;
  const userId = `u_e2e_${Date.now()}`;

  beforeAll(async () => {
    child = spawn('node', [join(__dirname, '..', 'dist', 'main.js')], {
      env: {
        ...process.env,
        PORT,
        DATABASE_HOST: process.env.DATABASE_HOST ?? 'localhost',
        DATABASE_PORT: process.env.DATABASE_PORT ?? '5433',
        DATABASE_USER: process.env.DATABASE_USER ?? 'pomodoro',
        DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? 'pomodoro',
        DATABASE_NAME: process.env.DATABASE_NAME ?? 'pomodoro',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
    });
    await waitForHealth();
  }, 30_000);

  afterAll(() => {
    child?.kill('SIGTERM');
  });

  it('GET /health', async () => {
    const res = await api('/health');
    expect(res.status).toBe(200);
  });

  it('starts, pauses, resumes, and stops a session', async () => {
    const started = await api('/api/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    expect(started.status).toBe(201);
    const startedBody = await json<{
      mode: string;
      remainingSeconds: number;
      cyclesUntilLongBreak: number;
    }>(started);
    expect(startedBody.mode).toBe('work');
    expect(startedBody.remainingSeconds).toBe(25 * 60);
    expect(startedBody.cyclesUntilLongBreak).toBe(4);

    const paused = await api('/api/v1/sessions/current', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({ action: 'pause' }),
    });
    expect(paused.status).toBe(200);
    const pausedBody = await json<{ remainingSeconds: number }>(paused);
    expect(pausedBody.remainingSeconds).toBeLessThanOrEqual(25 * 60);

    const resumed = await api('/api/v1/sessions/current', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({ action: 'resume' }),
    });
    expect(resumed.status).toBe(200);

    const stopped = await api('/api/v1/sessions/current', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
      },
      body: JSON.stringify({ action: 'stop' }),
    });
    expect(stopped.status).toBe(200);
    expect((await json<{ mode: string }>(stopped)).mode).toBe('idle');

    const missing = await api('/api/v1/sessions/current/status', {
      headers: { 'X-User-Id': userId },
    });
    expect(missing.status).toBe(404);
    expect((await json<{ code: string }>(missing)).code).toBe(
      'NO_ACTIVE_SESSION',
    );
  });

  it('returns 409 when starting an already active session', async () => {
    const id = `${userId}_conflict`;
    const first = await api('/api/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    });
    expect(first.status).toBe(201);
    const second = await api('/api/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    });
    expect(second.status).toBe(409);
    expect((await json<{ code: string }>(second)).code).toBe(
      'SESSION_ALREADY_ACTIVE',
    );
  });

  it('gets and replaces timer config', async () => {
    const id = `${userId}_cfg`;
    const got = await api(`/api/v1/users/${id}/config`);
    expect(got.status).toBe(200);
    expect(await json(got)).toMatchObject({
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
    });

    const updated = await api(`/api/v1/users/${id}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workMinutes: 25.5,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
      }),
    });
    expect(updated.status).toBe(200);
    expect((await json<{ workMinutes: number }>(updated)).workMinutes).toBe(
      25.5,
    );
  });

  it('rejects invalid copilot tool calls with 422 and no side effects', async () => {
    const id = `${userId}_copilot`;
    const res = await api('/api/v1/copilot/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ utterance: 'reset my settings', userId: id }),
    });
    expect(res.status).toBe(422);
    expect((await json<{ code: string }>(res)).code).toBe(
      'COPILOT_INVALID_TOOL_CALL',
    );

    const config = await api(`/api/v1/users/${id}/config`);
    expect(
      (await json<{ workMinutes: number }>(config)).workMinutes,
    ).toBe(25);
  });

  it('executes a deep-work copilot command', async () => {
    const id = `${userId}_deep`;
    const res = await api('/api/v1/copilot/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utterance: 'Start a 50-minute deep work session',
        userId: id,
      }),
    });
    expect(res.status).toBe(200);
    const body = await json<{ toolCalls: { status: string }[] }>(res);
    expect(body.toolCalls).toHaveLength(2);
    expect(body.toolCalls.every((c) => c.status === 'executed')).toBe(true);

    const config = await api(`/api/v1/users/${id}/config`);
    expect((await json<{ workMinutes: number }>(config)).workMinutes).toBe(50);
  });

  it('serializes concurrent pause and stop without 500s; final state is idle', async () => {
    const id = `${userId}_conc`;
    const started = await api('/api/v1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id }),
    });
    expect(started.status).toBe(201);

    const [pauseRes, stopRes] = await Promise.all([
      api('/api/v1/sessions/current', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': id,
        },
        body: JSON.stringify({ action: 'pause' }),
      }),
      api('/api/v1/sessions/current', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': id,
        },
        body: JSON.stringify({ action: 'stop' }),
      }),
    ]);

    for (const res of [pauseRes, stopRes]) {
      expect([200, 404]).toContain(res.status);
      expect(res.status).not.toBe(500);
    }

    const status = await api('/api/v1/sessions/current/status', {
      headers: { 'X-User-Id': id },
    });
    expect(status.status).toBe(404);
  });
});
