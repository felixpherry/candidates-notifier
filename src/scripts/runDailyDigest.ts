import 'dotenv/config';

import { createDailyDigestRuntime } from '../runtime/createDailyDigestRuntime.js';
import { logger } from '../utils/logger.js';

async function main(): Promise<void> {
  const { job, idempotency } = createDailyDigestRuntime(process.env, logger);

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
