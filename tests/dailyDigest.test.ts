import { describe, expect, it, vi } from 'vitest';

import { DailyDigestJob } from '../src/jobs/dailyDigest.js';
import type {
  AppConfig,
  DigestPayload,
  IdempotencyStore,
  MailSender,
} from '../src/types.js';
import type {
  LichessService,
  TournamentRoundSelection,
} from '../src/services/lichess.js';

function createConfig(): AppConfig {
  return {
    resendApiKey: 'key',
    emailTo: 'to@example.com',
    emailFrom: 'from@example.com',
    lichessApiBase: 'https://lichess.org/api',
    cronExpression: '0 20 * * *',
    appTimezone: 'Asia/Jakarta',
    openBroadcast: 'open-id',
    womensBroadcast: 'women-id',
    upstashRedisRestUrl: 'https://example.upstash.io',
    upstashRedisRestToken: 'token',
    redisKeyPrefix: 'candidates-2026',
  };
}

function createSelection(
  overrides: Partial<TournamentRoundSelection> = {},
): TournamentRoundSelection {
  return {
    kind: 'open',
    tournamentName: 'Open Candidates',
    broadcastId: 'broadcast',
    round: {
      id: 'round-1',
      name: 'Round 1',
      slug: 'round-1',
      startsAt: Date.parse('2026-04-02T06:00:00.000Z'),
    },
    ...overrides,
  };
}

describe('DailyDigestJob', () => {
  it('sends email and stores idempotency key when a digest exists', async () => {
    const selectRoundForDate = vi
      .fn()
      .mockResolvedValueOnce(createSelection())
      .mockResolvedValueOnce(
        createSelection({
          kind: 'womens',
          tournamentName: "Women's Candidates",
          round: {
            id: 'round-2',
            name: 'Round 1',
            slug: 'round-1',
            startsAt: Date.parse('2026-04-02T06:00:00.000Z'),
          },
        }),
      );
    const fetchRoundPgn = vi
      .fn()
      .mockResolvedValueOnce(
        '[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 1-0',
      )
      .mockResolvedValueOnce(
        '[White "C"]\n[Black "D"]\n[Result "1/2-1/2"]\n\n1. d4 d5 1/2-1/2',
      );
    const idempotency: IdempotencyStore = {
      has: vi.fn().mockResolvedValue(false),
      set: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const sendDigest = vi.fn<MailSender['sendDigest']>().mockResolvedValue();
    const job = new DailyDigestJob({
      config: createConfig(),
      lichess: {
        selectRoundForDate,
        fetchRoundPgn,
      } as unknown as LichessService,
      idempotency,
      mailSender: {
        sendDigest,
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      now: () => new Date('2026-04-02T20:00:00.000Z'),
    });

    const result = await job.run();

    expect(result.status).toBe('sent');
    expect(result.reason).toBe('email_sent');
    expect(sendDigest).toHaveBeenCalledTimes(1);
    expect(sendDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Candidates 2026 - Round 1',
      }) as Partial<DigestPayload>,
    );
    expect(idempotency.set).toHaveBeenCalledWith(
      'candidates-2026:digest:2026-04-02',
      expect.any(String),
    );
  });

  it('skips when the idempotency key already exists', async () => {
    const idempotency: IdempotencyStore = {
      has: vi.fn().mockResolvedValue(true),
      set: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const job = new DailyDigestJob({
      config: createConfig(),
      lichess: {
        selectRoundForDate: vi
          .fn()
          .mockResolvedValue(createSelection())
          .mockResolvedValueOnce(createSelection()),
        fetchRoundPgn: vi.fn(),
      } as unknown as LichessService,
      idempotency,
      mailSender: {
        sendDigest: vi.fn(),
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      now: () => new Date('2026-04-02T20:00:00.000Z'),
    });

    const result = await job.run();

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('already_sent');
  });

  it('does not store the key when sending fails', async () => {
    const selectRoundForDate = vi
      .fn()
      .mockResolvedValueOnce(createSelection())
      .mockResolvedValueOnce(
        createSelection({
          kind: 'womens',
          tournamentName: "Women's Candidates",
        }),
      );
    const fetchRoundPgn = vi.fn().mockResolvedValue(
      '[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 1-0',
    );
    const idempotency: IdempotencyStore = {
      has: vi.fn().mockResolvedValue(false),
      set: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    const job = new DailyDigestJob({
      config: createConfig(),
      lichess: {
        selectRoundForDate,
        fetchRoundPgn,
      } as unknown as LichessService,
      idempotency,
      mailSender: {
        sendDigest: vi.fn().mockRejectedValue(new Error('boom')),
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      now: () => new Date('2026-04-02T20:00:00.000Z'),
    });

    await expect(job.run()).rejects.toThrow('boom');
    expect(idempotency.set).not.toHaveBeenCalled();
  });

  it('skips when there are no matching rounds on the target date', async () => {
    const selectRoundForDate = vi
      .fn()
      .mockResolvedValueOnce(createSelection({ round: null }))
      .mockResolvedValueOnce(
        createSelection({
          kind: 'womens',
          tournamentName: "Women's Candidates",
          round: null,
        }),
      );
    const job = new DailyDigestJob({
      config: createConfig(),
      lichess: {
        selectRoundForDate,
        fetchRoundPgn: vi.fn(),
      } as unknown as LichessService,
      idempotency: {
        has: vi.fn().mockResolvedValue(false),
        set: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
      },
      mailSender: {
        sendDigest: vi.fn(),
      },
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      now: () => new Date('2026-04-02T20:00:00.000Z'),
    });

    const result = await job.run();

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('no_matching_round');
  });
});
