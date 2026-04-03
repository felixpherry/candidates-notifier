import { Redis } from '@upstash/redis';

import type {
  LiveGameState,
  TournamentKind,
  WorkerBindings,
} from '../types.js';

export interface RoundIdCache {
  getRoundId(kind: TournamentKind): Promise<string | null>;
  setRoundId(kind: TournamentKind, roundId: string): Promise<void>;
}

export class RedisLiveStateStore implements RoundIdCache {
  constructor(private readonly env: WorkerBindings) {}

  async acquireLock(): Promise<string | null> {
    const redis = this.createRedis();
    const token = crypto.randomUUID();
    const result = await redis.set('live:lock', token, {
      ex: 240,
      nx: true,
    });

    return result === 'OK' ? token : null;
  }

  async releaseLock(token: string): Promise<void> {
    const redis = this.createRedis();
    const current = await redis.get<string>('live:lock');

    if (current === token) {
      await redis.del('live:lock');
    }
  }

  async getState(gameId: string): Promise<LiveGameState | null> {
    const redis = this.createRedis();
    const value = await redis.get<string>(this.stateKey(gameId));
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as LiveGameState;
    } catch {
      return null;
    }
  }

  async setState(gameId: string, state: LiveGameState): Promise<void> {
    const redis = this.createRedis();
    await redis.set(this.stateKey(gameId), JSON.stringify(state), {
      ex: 28 * 60 * 60,
    });
  }

  async getRoundId(kind: TournamentKind): Promise<string | null> {
    const redis = this.createRedis();
    return redis.get<string>(this.roundKey(kind));
  }

  async setRoundId(kind: TournamentKind, roundId: string): Promise<void> {
    const redis = this.createRedis();
    await redis.set(this.roundKey(kind), roundId, { ex: 2 * 60 * 60 });
  }

  private createRedis(): Redis {
    return new Redis({
      url: this.env.UPSTASH_REDIS_REST_URL,
      token: this.env.UPSTASH_REDIS_REST_TOKEN,
      signal: AbortSignal.timeout(3000),
    });
  }

  private stateKey(gameId: string): string {
    return `live:${gameId}`;
  }

  private roundKey(kind: TournamentKind): string {
    return kind === 'open' ? 'round:open' : 'round:women';
  }
}
