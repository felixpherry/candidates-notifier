import 'dotenv/config';

import cron from 'node-cron';
import { serve } from '@hono/node-server';

import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';
import { DailyDigestJob } from './jobs/dailyDigest.js';
import { UpstashIdempotencyStore } from './services/idempotency.js';
import { LichessService } from './services/lichess.js';
import { ResendMailSender } from './services/mailer.js';
import { logger } from './utils/logger.js';

const config = loadConfig();

const lichess = new LichessService(config.lichessApiBase, logger);
const idempotency = new UpstashIdempotencyStore(
  config.upstashRedisRestUrl,
  config.upstashRedisRestToken,
);
const mailSender = new ResendMailSender(
  config.resendApiKey,
  config.emailFrom,
  config.emailTo,
);
const job = new DailyDigestJob({
  config,
  lichess,
  idempotency,
  mailSender,
  logger,
});

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
    fetch: buildApp(config).fetch,
    port,
  },
  () => {
    logger.info('HTTP server started', { port });
  },
);
