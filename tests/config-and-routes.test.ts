import { describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';

describe('config and routes', () => {
  it('loads and normalizes config', () => {
    const config = loadConfig({
      RESEND_API_KEY: 'key',
      EMAIL_TO: 'to@example.com',
      EMAIL_FROM: 'from@example.com',
      LICHESS_API_BASE: 'https://lichess.org/api/',
      CRON_EXPRESSION: '0 20 * * *',
      APP_TIMEZONE: 'Asia/Jakarta',
      OPEN_BROADCAST_URL_OR_ID: 'open-id',
      WOMENS_BROADCAST_URL_OR_ID: 'women-id',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });

    expect(config.lichessApiBase).toBe('https://lichess.org/api');
    expect(config.redisKeyPrefix).toBe('candidates-2026');
    expect(config.upstashRedisRestUrl).toBe('https://example.upstash.io');
  });

  it('exposes health endpoint', async () => {
    const config = loadConfig({
      RESEND_API_KEY: 'key',
      EMAIL_TO: 'to@example.com',
      EMAIL_FROM: 'from@example.com',
      LICHESS_API_BASE: 'https://lichess.org/api',
      CRON_EXPRESSION: '0 20 * * *',
      APP_TIMEZONE: 'Asia/Jakarta',
      OPEN_BROADCAST_URL_OR_ID: 'open-id',
      WOMENS_BROADCAST_URL_OR_ID: 'women-id',
      UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });
    const response = await buildApp({ config }).request('/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        service: 'candidates-notifier',
      }),
    );
  });

  it('returns config errors without crashing health checks', async () => {
    const response = await buildApp({
      configError: 'Missing env vars',
    }).request('/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        configError: 'Missing env vars',
      }),
    );
  });

  it('rejects manual trigger requests without a valid token', async () => {
    const response = await buildApp({
      manualTriggerToken: 'secret-token',
      triggerDigest: vi.fn(),
    }).request('/run-now');

    expect(response.status).toBe(401);
  });

  it('allows manual trigger requests with the correct query token', async () => {
    const response = await buildApp({
      manualTriggerToken: 'secret-token',
      triggerDigest: vi.fn().mockResolvedValue({
        status: 'skipped',
        reason: 'already_sent',
        key: 'candidates-2026:digest:2026-04-02',
        targetDate: '2026-04-02',
        roundNames: ['Round 4'],
      }),
    }).request('/run-now?token=secret-token');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        status: 'skipped',
        reason: 'already_sent',
      }),
    );
  });

  it('returns trigger errors as json for manual runs', async () => {
    const response = await buildApp({
      manualTriggerToken: 'secret-token',
      triggerDigest: vi.fn().mockRejectedValue(new Error('Boom')),
    }).request('/run-now?token=secret-token');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: 'Boom',
      }),
    );
  });

  it('allows manual live monitor requests with the correct query token', async () => {
    const response = await buildApp({
      manualTriggerToken: 'secret-token',
      triggerLiveMonitor: vi.fn().mockResolvedValue({
        status: 'ok',
        rounds: [
          {
            kind: 'womens',
            roundId: 'MDv2BlCp',
            roundName: 'Round 4',
            gamesSeen: 7,
            notificationsSent: 1,
          },
        ],
      }),
    }).request('/run-live-now?token=secret-token');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        status: 'ok',
        rounds: expect.arrayContaining([
          expect.objectContaining({
            kind: 'womens',
            roundId: 'MDv2BlCp',
          }),
        ]),
      }),
    );
  });

  it('returns an error when live manual trigger is not enabled', async () => {
    const response = await buildApp({}).request('/run-live-now');

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        error: 'Live manual trigger is not enabled.',
      }),
    );
  });
});
