import 'dotenv/config';

import cron from 'node-cron';
import { serve } from '@hono/node-server';

import { buildApp } from './app.js';
import { createDailyDigestRuntime } from './runtime/createDailyDigestRuntime.js';
import { logger } from './utils/logger.js';

const { config, job } = createDailyDigestRuntime(process.env, logger);

cron.schedule(
  config.cronExpression,
  async () => {
    try {
      await job.run();
    } catch (error) {
      logger.error('Scheduled digest job failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
  {
    timezone: 'UTC',
  },
);

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
serve(
  {
    fetch: buildApp({ config }).fetch,
    port,
  },
  () => {
    logger.info('HTTP server started', { port });
  },
);
