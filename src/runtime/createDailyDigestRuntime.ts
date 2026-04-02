import { loadConfig } from '../config/env.js';
import { DailyDigestJob } from '../jobs/dailyDigest.js';
import { UpstashIdempotencyStore } from '../services/idempotency.js';
import { LichessService } from '../services/lichess.js';
import { ResendMailSender } from '../services/mailer.js';
import type { Logger } from '../utils/logger.js';

export function createDailyDigestRuntime<TEnv extends object>(
  env: TEnv,
  logger: Logger,
) {
  const config = loadConfig(env as NodeJS.ProcessEnv);
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

  return {
    config,
    job,
    idempotency,
  };
}
