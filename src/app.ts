import { Hono } from 'hono';

import { buildHealthRoutes } from './routes/health.js';
import type { AppConfig } from './types.js';
import type { JobRunResult } from './types.js';
import type { LiveMonitorJobResult } from './types.js';
import type { LiveMonitorTriggerOptions } from './types.js';

interface AppOptions {
  config?: AppConfig;
  configError?: string;
  manualTriggerToken?: string;
  triggerDigest?: () => Promise<JobRunResult>;
  triggerLiveMonitor?: (
    options?: LiveMonitorTriggerOptions,
  ) => Promise<LiveMonitorJobResult>;
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

    try {
      const result = await options.triggerDigest();

      return c.json({
        ok: true,
        status: result.status,
        reason: result.reason,
        key: result.key,
        targetDate: result.targetDate,
        roundNames: result.roundNames,
      });
    } catch (error) {
      return c.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  });

  app.on(['GET', 'POST'], '/run-live-now', async (c) => {
    if (!options.manualTriggerToken || !options.triggerLiveMonitor) {
      return c.json(
        {
          ok: false,
          error: 'Live manual trigger is not enabled.',
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

    try {
      const roundId = c.req.query('roundId')?.trim();
      const white = c.req.query('white')?.trim();
      const black = c.req.query('black')?.trim();
      const moveNumberRaw = c.req.query('moveNumber')?.trim();
      const moveNumber = moveNumberRaw
        ? Number.parseInt(moveNumberRaw, 10)
        : undefined;
      const triggerOptions =
        roundId || white || black || moveNumberRaw
          ? {
              roundId: roundId || undefined,
              white: white || undefined,
              black: black || undefined,
              moveNumber:
                moveNumberRaw && Number.isFinite(moveNumber) ? moveNumber : undefined,
            }
          : undefined;

      const result = await options.triggerLiveMonitor(triggerOptions);

      return c.json({
        ok: true,
        status: result.status,
        rounds: result.rounds,
      });
    } catch (error) {
      return c.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  });

  return app;
}
