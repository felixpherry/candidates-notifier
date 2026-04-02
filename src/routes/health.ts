import { Hono } from 'hono';

import type { AppConfig } from '../types.js';

export function buildHealthRoutes(config: AppConfig): Hono {
  const app = new Hono();

  app.get('/health', (c) =>
    c.json({
      ok: true,
      service: 'candidates-notifier',
      timestamp: new Date().toISOString(),
    }),
  );

  app.get('/status', (c) =>
    c.json({
      ok: true,
      cronExpression: config.cronExpression,
      timeZone: config.appTimezone,
      broadcasts: {
        open: config.openBroadcast,
        womens: config.womensBroadcast,
      },
    }),
  );

  return app;
}
