export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

function log(
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  context?: Record<string, unknown>,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {}),
  };

  console.log(JSON.stringify(entry));
}

export const logger: Logger = {
  info(message, context) {
    log('INFO', message, context);
  },
  warn(message, context) {
    log('WARN', message, context);
  },
  error(message, context) {
    log('ERROR', message, context);
  },
};
