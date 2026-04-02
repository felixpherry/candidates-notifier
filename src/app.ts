import { Hono } from 'hono';

import { buildHealthRoutes } from './routes/health.js';
import type { AppConfig } from './types.js';

interface AppOptions {
  config?: AppConfig;
  configError?: string;
}

export function buildApp(options: AppOptions): Hono {
  const app = new Hono();
  app.route('/', buildHealthRoutes(options));
  return app;
}
