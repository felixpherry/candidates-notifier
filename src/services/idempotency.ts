import { Redis } from '@upstash/redis';

import type { IdempotencyStore } from '../types.js';

export class UpstashIdempotencyStore implements IdempotencyStore {
  private readonly redis: Redis;

  constructor(url: string, token: string) {
    this.redis = new Redis({
      url,
      token,
    });
  }

  async has(key: string): Promise<boolean> {
    const value = await this.redis.get<string>(key);
    return value !== null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.redis.set(key, value);
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }
}
