import { buildApp } from './app.js';
import { createDailyDigestRuntime } from './runtime/createDailyDigestRuntime.js';
import { logger } from './utils/logger.js';

interface WorkerBindings {
  RESEND_API_KEY: string;
  EMAIL_TO: string;
  EMAIL_FROM: string;
  LICHESS_API_BASE?: string;
  CRON_EXPRESSION?: string;
  APP_TIMEZONE?: string;
  OPEN_BROADCAST_URL_OR_ID: string;
  WOMENS_BROADCAST_URL_OR_ID: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  REDIS_KEY_PREFIX?: string;
}

const worker = {
  async fetch(request: Request, env: WorkerBindings): Promise<Response> {
    try {
      const { config } = createDailyDigestRuntime(env, logger);
      return buildApp({ config }).fetch(request);
    } catch (error) {
      logger.error('Worker fetch configuration failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return buildApp({
        configError: error instanceof Error ? error.message : String(error),
      }).fetch(request);
    }
  },

  async scheduled(
    _controller: unknown,
    env: WorkerBindings,
  ): Promise<void> {
    const runtime = createDailyDigestRuntime(env, logger);

    try {
      const result = await runtime.job.run();
      logger.info('Scheduled digest job completed', {
        status: result.status,
        reason: result.reason,
        key: result.key,
        targetDate: result.targetDate,
        roundNames: result.roundNames,
      });
    } finally {
      await runtime.idempotency.disconnect();
    }
  },
};

export default worker;
