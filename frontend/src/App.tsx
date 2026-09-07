import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Container,
  Flex,
  Heading,
  HStack,
  Input,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import {
  api,
  type CopilotResult,
  type Mode,
  type SessionStatus,
  type TimerConfig,
} from './api';

function formatMmSs(total: number): string {
  const seconds = Math.max(0, Math.floor(total));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function modeLabel(mode: Mode): string {
  switch (mode) {
    case 'work':
      return 'Work';
    case 'short_break':
      return 'Short break';
    case 'long_break':
      return 'Long break';
    case 'idle':
      return 'Idle';
  }
}

function modeColor(mode: Mode): string {
  switch (mode) {
    case 'work':
      return 'red';
    case 'short_break':
      return 'green';
    case 'long_break':
      return 'blue';
    case 'idle':
      return 'gray';
  }
}

const DEFAULT_CONFIG: TimerConfig = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
};

export default function App() {
  const [userId, setUserId] = useState('u_123');
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [paused, setPaused] = useState(false);
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [utterance, setUtterance] = useState(
    'Start a 50-minute deep work session, then take a short break.',
  );
  const [copilot, setCopilot] = useState<CopilotResult | null>(null);

  const active = status !== null && status.mode !== 'idle';

  const refreshStatus = useCallback(async () => {
    try {
      const next = await api.status(userId);
      setStatus((prev) => {
        if (
          prev &&
          prev.remainingSeconds === next.remainingSeconds &&
          prev.mode === next.mode &&
          next.mode !== 'idle'
        ) {
          setPaused(true);
        } else if (
          prev &&
          next.remainingSeconds < prev.remainingSeconds
        ) {
          setPaused(false);
        }
        return next;
      });
      setError(null);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'NO_ACTIVE_SESSION') {
        setStatus(null);
        setPaused(false);
        setError(null);
        return;
      }
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  }, [userId]);

  const loadConfig = useCallback(async () => {
    try {
      setConfig(await api.getConfig(userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    }
  }, [userId]);

  useEffect(() => {
    void loadConfig();
    void refreshStatus();
  }, [loadConfig, refreshStatus]);

  useEffect(() => {
    if (!active || paused) {
      return;
    }
    const id = window.setInterval(() => {
      void refreshStatus();
    }, 1000);
    return () => window.clearInterval(id);
  }, [active, paused, refreshStatus]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const displaySeconds = status?.remainingSeconds ?? 0;
  const mode: Mode = status?.mode ?? 'idle';

  const cycleHint = useMemo(() => {
    if (!status) {
      return 'Start a session to track cycles.';
    }
    return `${status.completedCycles} work interval(s) completed · ${status.cyclesUntilLongBreak} until long break`;
  }, [status]);

  return (
    <Box bg="gray.50" minH="100vh" py="10">
      <Container maxW="lg">
        <Stack gap="6">
          <Box>
            <Heading size="xl">Pomodoro</Heading>
            <Text color="gray.600">
              Server-authoritative timer. State is stored in Postgres, not in this tab.
            </Text>
          </Box>

          <Card.Root>
            <Card.Body>
              <Stack gap="3">
                <Text fontWeight="medium">User ID</Text>
                <Input
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  aria-label="User ID"
                />
                <Text fontSize="sm" color="gray.500">
                  Sent as JSON on start, and as the X-User-Id header on pause/resume/stop/status.
                </Text>
              </Stack>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <Stack gap="4" align="center">
                <Badge colorPalette={modeColor(mode)} size="lg">
                  {modeLabel(mode)}
                  {active && paused ? ' · paused' : ''}
                </Badge>
                <Text
                  fontFamily="mono"
                  fontSize="6xl"
                  fontWeight="bold"
                  lineHeight="1"
                  letterSpacing="tight"
                >
                  {formatMmSs(displaySeconds)}
                </Text>
                <Text color="gray.600">{cycleHint}</Text>
                <HStack wrap="wrap" justify="center">
                  <Button
                    colorPalette="red"
                    disabled={busy || active}
                    onClick={() =>
                      run(async () => {
                        const next = await api.startSession(userId);
                        setStatus(next);
                        setPaused(false);
                      })
                    }
                  >
                    Start
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !active || paused}
                    onClick={() =>
                      run(async () => {
                        const next = await api.action(userId, 'pause');
                        setStatus(next);
                        setPaused(true);
                      })
                    }
                  >
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !active || !paused}
                    onClick={() =>
                      run(async () => {
                        const next = await api.action(userId, 'resume');
                        setStatus(next);
                        setPaused(false);
                      })
                    }
                  >
                    Resume
                  </Button>
                  <Button
                    variant="subtle"
                    disabled={busy || !active}
                    onClick={() =>
                      run(async () => {
                        await api.action(userId, 'stop');
                        setStatus(null);
                        setPaused(false);
                      })
                    }
                  >
                    Reset
                  </Button>
                </HStack>
              </Stack>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <Stack gap="3">
                <Heading size="md">Durations (minutes)</Heading>
                <Flex gap="3" wrap="wrap">
                  <Box flex="1" minW="120px">
                    <Text fontSize="sm">Work</Text>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.02"
                      value={config.workMinutes}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          workMinutes: Number(e.target.value),
                        })
                      }
                    />
                  </Box>
                  <Box flex="1" minW="120px">
                    <Text fontSize="sm">Short break</Text>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.02"
                      value={config.shortBreakMinutes}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          shortBreakMinutes: Number(e.target.value),
                        })
                      }
                    />
                  </Box>
                  <Box flex="1" minW="120px">
                    <Text fontSize="sm">Long break</Text>
                    <Input
                      type="number"
                      step="0.5"
                      min="0.02"
                      value={config.longBreakMinutes}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          longBreakMinutes: Number(e.target.value),
                        })
                      }
                    />
                  </Box>
                </Flex>
                <Button
                  alignSelf="start"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      setConfig(await api.putConfig(userId, config));
                    })
                  }
                >
                  Save config
                </Button>
                <Text fontSize="sm" color="gray.500">
                  Saving does not rewrite an in-flight interval; it applies to the next one.
                </Text>
              </Stack>
            </Card.Body>
          </Card.Root>

          <Card.Root>
            <Card.Body>
              <Stack gap="3">
                <Heading size="md">Copilot</Heading>
                <Textarea
                  value={utterance}
                  onChange={(e) => setUtterance(e.target.value)}
                  rows={3}
                />
                <Button
                  alignSelf="start"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const result = await api.copilot(userId, utterance);
                      setCopilot(result);
                      await refreshStatus();
                      await loadConfig();
                    })
                  }
                >
                  Run command
                </Button>
                {copilot && (
                  <Box>
                    <Text mb="2">{copilot.message}</Text>
                    <Stack gap="1" fontSize="sm" fontFamily="mono">
                      {copilot.toolCalls.map((call, i) => (
                        <Text key={`${call.tool}-${i}`}>
                          {call.status} · {call.tool} — {call.detail}
                        </Text>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Card.Body>
          </Card.Root>

          {error && (
            <Box
              bg="red.50"
              color="red.800"
              px="4"
              py="3"
              rounded="md"
              borderWidth="1px"
              borderColor="red.200"
            >
              {error}
            </Box>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
