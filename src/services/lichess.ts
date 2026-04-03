import { extractBroadcastId } from '../utils/broadcast.js';
import { roundMatchesDate } from '../utils/datetime.js';
import { HttpStatusError, withRetry } from '../utils/retry.js';
import type { Logger } from '../utils/logger.js';
import type { RoundSummary, TournamentKind } from '../types.js';
import type { RoundIdCache } from './gameState.js';

interface BroadcastResponse {
  tour: {
    id: string;
    name: string;
    slug: string;
    url?: string;
  };
  rounds: Array<RoundSummary>;
}

interface CloudEvalResponse {
  pvs?: Array<{
    cp?: number;
    mate?: number;
  }>;
}

export interface TournamentRoundSelection {
  kind: TournamentKind;
  tournamentName: string;
  broadcastId: string;
  round: RoundSummary | null;
}

export class LichessService {
  constructor(
    private readonly apiBase: string,
    private readonly logger: Logger,
    private readonly fetchImpl: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
    private readonly roundCache?: RoundIdCache,
  ) {}

  async selectRoundForDate(
    kind: TournamentKind,
    broadcastRef: string,
    targetDate: string,
    timeZone: string,
  ): Promise<TournamentRoundSelection> {
    const broadcastId = extractBroadcastId(broadcastRef);
    const broadcast = await this.fetchBroadcast(broadcastId);
    const cachedRoundId = await this.roundCache?.getRoundId(kind);
    const round =
      (cachedRoundId
        ? broadcast.rounds.find((item) => item.id === cachedRoundId)
        : null) ??
      broadcast.rounds.find((item) =>
        roundMatchesDate(item.startsAt, targetDate, timeZone),
      ) ??
      null;

    if (round && (!cachedRoundId || cachedRoundId !== round.id)) {
      await this.roundCache?.setRoundId(kind, round.id);
    }

    this.logger.info('Selected round for digest target date', {
      kind,
      targetDate,
      timeZone,
      broadcastId,
      roundId: round?.id ?? null,
      roundName: round?.name ?? null,
    });

    return {
      kind,
      tournamentName: broadcast.tour.name,
      broadcastId,
      round,
    };
  }

  async fetchRoundPgn(roundId: string): Promise<string> {
    const response = await this.request(`/broadcast/round/${roundId}.pgn`, {
      headers: {
        Accept: 'application/x-chess-pgn',
      },
    });

    return response.text();
  }

  async fetchCloudEval(fen: string): Promise<number | null> {
    try {
      const response = await this.request(
        `/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
        { retry: false },
      );

      const payload = (await response.json()) as CloudEvalResponse;
      return this.parseCloudEval(payload);
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 404) {
        return null;
      }

      if (isAbortError(error)) {
        return null;
      }

      throw error;
    }
  }

  private async fetchBroadcast(broadcastId: string): Promise<BroadcastResponse> {
    const response = await this.request(`/broadcast/${broadcastId}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    return response.json() as Promise<BroadcastResponse>;
  }

  private async request(
    path: string,
    init?: RequestInit,
    options: { retry?: boolean } = {},
  ): Promise<Response> {
    const operation = async () => {
      const response = await this.fetchImpl(`${this.apiBase}${path}`, {
        ...init,
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new HttpStatusError(response.status, body);
      }

      return response;
    };

    return options.retry === false ? operation() : withRetry(operation);
  }

  private parseCloudEval(payload: CloudEvalResponse): number | null {
    const pv = payload.pvs?.[0];
    if (!pv) {
      return null;
    }

    if (typeof pv.cp === 'number') {
      return pv.cp;
    }

    if (typeof pv.mate === 'number') {
      const distance = Math.abs(pv.mate);
      return pv.mate > 0 ? 10000 - distance : -10000 + distance;
    }

    return null;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name !== undefined &&
    ((error as { name?: string }).name === 'AbortError' ||
      (error as { name?: string }).name === 'TimeoutError')
  );
}
