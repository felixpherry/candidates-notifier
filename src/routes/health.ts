import { Hono } from 'hono';

import type { AppConfig } from '../types.js';

interface HealthRouteOptions {
  config?: AppConfig;
  configError?: string;
}

export function buildHealthRoutes(options: HealthRouteOptions): Hono {
  const app = new Hono();

  app.get('/health', (c) =>
    c.json({
      ok: !options.configError,
      service: 'candidates-notifier',
      timestamp: new Date().toISOString(),
      ...(options.configError ? { configError: options.configError } : {}),
    }),
  );

  app.get('/status', (c) => {
    if (!options.config) {
      return c.json(
        {
          ok: false,
          configError: options.configError ?? 'Configuration unavailable.',
        },
        500,
      );
    }

    return c.json({
      ok: true,
      cronExpression: options.config.cronExpression,
      timeZone: options.config.appTimezone,
      broadcasts: {
        open: options.config.openBroadcast,
        womens: options.config.womensBroadcast,
      },
    });
  });

  return app;
}
