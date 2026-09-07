import { CopilotService } from './copilot.service';
import { FakeLlmProvider } from './llm-provider';
import { AppError } from '../common/errors';
import type { TimerPort } from '../timer/timer.port';

function mockTimer(): jest.Mocked<TimerPort> {
  return {
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
    patchConfig: jest.fn(),
    startSession: jest.fn(),
    getStatus: jest.fn(),
    applyAction: jest.fn(),
  };
}

describe('CopilotService', () => {
  const userId = 'u_123';

  it('validates then executes canned deep-work tool calls', async () => {
    const timer = mockTimer();
    timer.patchConfig.mockResolvedValue({
      workMinutes: 50,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
    });
    timer.startSession.mockResolvedValue({
      sessionId: 's_789',
      userId,
      mode: 'work',
      remainingSeconds: 3000,
      completedCycles: 0,
      cyclesUntilLongBreak: 4,
    });
    const service = new CopilotService(timer, new FakeLlmProvider());

    const result = await service.run(
      'Start a 50-minute deep work session, then take a short break.',
      userId,
    );

    expect(timer.patchConfig).toHaveBeenCalledWith(userId, { workMinutes: 50 });
    expect(timer.startSession).toHaveBeenCalledWith(userId);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls.every((c) => c.status === 'executed')).toBe(true);
    expect(result.toolCalls[1].arguments.userId).toBe(userId);
  });

  it('returns 422 and executes nothing for invalid tool calls', async () => {
    const timer = mockTimer();
    const service = new CopilotService(timer, new FakeLlmProvider());

    await expect(service.run('reset my settings', userId)).rejects.toBeInstanceOf(
      AppError,
    );
    try {
      await service.run('reset my settings', userId);
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.getStatus()).toBe(422);
      expect(appErr.getResponse()).toEqual(
        expect.objectContaining({
          code: 'COPILOT_INVALID_TOOL_CALL',
          message: expect.stringContaining('deleteAllSessions'),
        }),
      );
    }
    expect(timer.patchConfig).not.toHaveBeenCalled();
    expect(timer.applyAction).not.toHaveBeenCalled();
  });

  it('returns 200 with an empty audit trail when the model produces no tools', async () => {
    const timer = mockTimer();
    const service = new CopilotService(timer, new FakeLlmProvider());
    const result = await service.run('hello there', userId);
    expect(result.toolCalls).toEqual([]);
    expect(timer.startSession).not.toHaveBeenCalled();
  });
});
