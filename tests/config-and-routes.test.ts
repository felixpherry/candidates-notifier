import { describe, expect, it } from 'vitest';

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
    const response = await buildApp(config).request('/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        service: 'candidates-notifier',
      }),
    );
  });
});
