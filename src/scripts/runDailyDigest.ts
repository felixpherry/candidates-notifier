import 'dotenv/config';

import { loadConfig } from '../config/env.js';
import { DailyDigestJob } from '../jobs/dailyDigest.js';
import { UpstashIdempotencyStore } from '../services/idempotency.js';
import { LichessService } from '../services/lichess.js';
import { ResendMailSender } from '../services/mailer.js';
import { logger } from '../utils/logger.js';

async function main(): Promise<void> {
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

  try {
    const result = await job.run();
    logger.info('Daily digest job completed', {
      status: result.status,
      reason: result.reason,
      key: result.key,
      targetDate: result.targetDate,
      roundNames: result.roundNames,
    });
  } finally {
    await idempotency.disconnect();
  }
}

main().catch((error) => {
  logger.error('Daily digest job failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
