import { extractBroadcastId } from '../utils/broadcast.js';
import { roundMatchesDate } from '../utils/datetime.js';
import { HttpStatusError, withRetry } from '../utils/retry.js';
import type { Logger } from '../utils/logger.js';
import type { RoundSummary, TournamentKind } from '../types.js';

interface BroadcastResponse {
  tour: {
    id: string;
    name: string;
    slug: string;
    url?: string;
  };
  rounds: Array<RoundSummary>;
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
  ) {}

  async selectRoundForDate(
    kind: TournamentKind,
    broadcastRef: string,
    targetDate: string,
    timeZone: string,
  ): Promise<TournamentRoundSelection> {
    const broadcastId = extractBroadcastId(broadcastRef);
    const broadcast = await this.fetchBroadcast(broadcastId);
    const round =
      broadcast.rounds.find((item) =>
        roundMatchesDate(item.startsAt, targetDate, timeZone),
      ) ?? null;

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
  ): Promise<Response> {
    return withRetry(async () => {
      const response = await this.fetchImpl(`${this.apiBase}${path}`, init);

      if (!response.ok) {
        const body = await response.text();
        throw new HttpStatusError(response.status, body);
      }

      return response;
    });
  }
}
