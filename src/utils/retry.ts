interface RetryOptions {
  attempts?: number;
  backoffMs?: number[];
}

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    message = `Request failed with status ${status}`,
  ) {
    super(message);
  }
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpStatusError) {
    return error.status === 429 || error.status >= 500;
  }

  return true;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const backoffMs = options.backoffMs ?? [1000, 2000, 4000, 8000, 16000];
  const attempts = options.attempts ?? backoffMs.length;
  let lastError: unknown;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || index === attempts - 1) {
        throw error;
      }

      await sleep(backoffMs[index] ?? backoffMs[backoffMs.length - 1] ?? 1000);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
