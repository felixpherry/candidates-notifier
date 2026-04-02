import { Hono } from 'hono';

import { buildHealthRoutes } from './routes/health.js';
import type { AppConfig } from './types.js';

export function buildApp(config: AppConfig): Hono {
  const app = new Hono();
  app.route('/', buildHealthRoutes(config));
  return app;
}
