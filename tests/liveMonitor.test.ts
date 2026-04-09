import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
  getState: vi.fn(),
  setState: vi.fn(),
  selectRoundForDate: vi.fn(),
  fetchRoundPgn: vi.fn(),
  fetchCloudEval: vi.fn(),
  sendResendEmail: vi.fn(),
}));

vi.mock('../src/services/gameState.js', () => ({
  RedisLiveStateStore: class {
    acquireLock = mocks.acquireLock;
    releaseLock = mocks.releaseLock;
    getState = mocks.getState;
    setState = mocks.setState;
  },
}));

vi.mock('../src/services/lichess.js', () => ({
  LichessService: class {
    selectRoundForDate = mocks.selectRoundForDate;
    fetchRoundPgn = mocks.fetchRoundPgn;
    fetchCloudEval = mocks.fetchCloudEval;
  },
}));

vi.mock('../src/services/mailer.js', () => ({
  sendResendEmail: mocks.sendResendEmail,
}));

import { liveMonitorJob } from '../src/jobs/liveMonitor.js';
import type { WorkerBindings } from '../src/types.js';
import type { Logger } from '../src/utils/logger.js';

const env: WorkerBindings = {
  RESEND_API_KEY: 'key',
  EMAIL_TO: 'to@example.com',
  EMAIL_FROM: 'from@example.com',
  OPEN_BROADCAST_URL_OR_ID: 'open-broadcast',
  WOMENS_BROADCAST_URL_OR_ID: 'women-broadcast',
  UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'token',
  APP_TIMEZONE: 'Asia/Jakarta',
};

const multiGamePgn = `
[Event "Candidates"]
[Site "https://lichess.org/game-one"]
[White "Caruana, Fabiano"]
[Black "Nakamura, Hikaru"]
[Round "Round 10"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O *

[Event "Candidates"]
[Site "https://lichess.org/game-two"]
[White "Gukesh, D"]
[Black "Firouzja, Alireza"]
[Round "Round 10"]
[Result "*"]

1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O 5. Bd3 d5 6. Nf3 c5 7. O-O Nc6 8. a3 Ba5 *
`;

function createLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('liveMonitorJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.acquireLock.mockResolvedValue('lock-token');
    mocks.releaseLock.mockResolvedValue(undefined);
    mocks.getState.mockResolvedValue(null);
    mocks.setState.mockResolvedValue(undefined);
    mocks.fetchRoundPgn.mockResolvedValue(multiGamePgn);
    mocks.sendResendEmail.mockResolvedValue(undefined);
    mocks.selectRoundForDate
      .mockResolvedValueOnce({
        kind: 'open',
        tournamentName: 'Candidates',
        broadcastId: 'open-broadcast',
        round: {
          id: 'open-round',
          name: 'Round 10',
          slug: 'round-10',
          startsAt: 0,
        },
      })
      .mockResolvedValueOnce({
        kind: 'womens',
        tournamentName: "Women's Candidates",
        broadcastId: 'women-broadcast',
        round: null,
      });
  });

  it('skips only the failing live game when cloud eval errors', async () => {
    mocks.fetchCloudEval
      .mockRejectedValueOnce(new Error('cloud eval timeout'))
      .mockResolvedValueOnce(42);
    const logger = createLogger();

    const result = await liveMonitorJob(env, logger);

    expect(result).toEqual({
      status: 'ok',
      rounds: [
        {
          kind: 'open',
          roundId: 'open-round',
          roundName: 'Round 10',
          gamesSeen: 2,
          notificationsSent: 0,
        },
      ],
    });
    expect(mocks.fetchCloudEval).toHaveBeenCalledTimes(2);
    expect(mocks.setState).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'Cloud eval fetch failed; skipping game',
      expect.objectContaining({
        gameId: 'game-one',
        roundName: 'Round 10',
        error: 'cloud eval timeout',
      }),
    );
  });
});
