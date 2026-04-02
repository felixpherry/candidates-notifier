import { Hono } from 'hono';

import { buildHealthRoutes } from './routes/health.js';
import type { AppConfig } from './types.js';
import type { JobRunResult } from './types.js';

interface AppOptions {
  config?: AppConfig;
  configError?: string;
  manualTriggerToken?: string;
  triggerDigest?: () => Promise<JobRunResult>;
}

export function buildApp(options: AppOptions): Hono {
  const app = new Hono();
  app.route('/', buildHealthRoutes(options));

  app.on(['GET', 'POST'], '/run-now', async (c) => {
    if (!options.manualTriggerToken || !options.triggerDigest) {
      return c.json(
        {
          ok: false,
          error: 'Manual trigger is not enabled.',
        },
        404,
      );
    }

    const bearerToken = c.req.header('authorization')?.replace(/^Bearer\s+/i, '');
    const queryToken = c.req.query('token');
    const providedToken = bearerToken ?? queryToken;

    if (providedToken !== options.manualTriggerToken) {
      return c.json(
        {
          ok: false,
          error: 'Unauthorized.',
        },
        401,
      );
    }

    const result = await options.triggerDigest();

    return c.json({
      ok: true,
      status: result.status,
      reason: result.reason,
      key: result.key,
      targetDate: result.targetDate,
      roundNames: result.roundNames,
    });
  });

  return app;
}
