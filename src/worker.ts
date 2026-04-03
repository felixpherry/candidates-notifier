import { buildApp } from './app.js';
import { liveMonitorJob } from './jobs/liveMonitor.js';
import { createDailyDigestRuntime } from './runtime/createDailyDigestRuntime.js';
import { logger } from './utils/logger.js';
import type { WorkerBindings } from './types.js';

const worker = {
  async fetch(request: Request, env: WorkerBindings): Promise<Response> {
    try {
      const { config } = createDailyDigestRuntime(env, logger);
      return buildApp({
        config,
        manualTriggerToken: env.MANUAL_TRIGGER_TOKEN,
        triggerDigest: async () => {
          const runtime = createDailyDigestRuntime(env, logger);

          try {
            return await runtime.job.run();
          } finally {
            await runtime.idempotency.disconnect();
          }
        },
        triggerLiveMonitor: async (options) => {
          return liveMonitorJob(env, logger, options);
        },
      }).fetch(request);
    } catch (error) {
      logger.error('Worker fetch configuration failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return buildApp({
        configError: error instanceof Error ? error.message : String(error),
      }).fetch(request);
    }
  },

  async scheduled(event: { cron: string }, env: WorkerBindings): Promise<void> {
    logger.info('Scheduled trigger received', {
      cron: event.cron,
      mode: event.cron === '*/5 1-19 * * *' ? 'live' : 'digest',
    });

    if (event.cron === '*/5 1-19 * * *') {
      try {
        await liveMonitorJob(env, logger);
      } catch (error) {
        logger.error('Scheduled live monitor job failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

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
