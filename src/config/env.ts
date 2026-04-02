import { z } from 'zod';

import type { AppConfig } from '../types';

const envSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  EMAIL_TO: z.string(),
  EMAIL_FROM: z.string().min(1),
  LICHESS_API_BASE: z.string().default('https://lichess.org/api'),
  CRON_EXPRESSION: z.string().min(1).default('0 20 * * *'),
  APP_TIMEZONE: z.string().min(1).default('Asia/Jakarta'),
  OPEN_BROADCAST_URL_OR_ID: z.string().min(1),
  WOMENS_BROADCAST_URL_OR_ID: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
  REDIS_KEY_PREFIX: z.string().min(1).default('candidates-2026'),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  return {
    resendApiKey: parsed.RESEND_API_KEY,
    emailTo: parsed.EMAIL_TO,
    emailFrom: parsed.EMAIL_FROM,
    lichessApiBase: parsed.LICHESS_API_BASE.replace(/\/$/, ''),
    cronExpression: parsed.CRON_EXPRESSION,
    appTimezone: parsed.APP_TIMEZONE,
    openBroadcast: parsed.OPEN_BROADCAST_URL_OR_ID,
    womensBroadcast: parsed.WOMENS_BROADCAST_URL_OR_ID,
    upstashRedisRestUrl: parsed.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: parsed.UPSTASH_REDIS_REST_TOKEN,
    redisKeyPrefix: parsed.REDIS_KEY_PREFIX,
  };
}
