import { Resend } from 'resend';

import { loadConfig } from '../config/env.js';
import { RedisLiveStateStore } from '../services/gameState.js';
import { LichessService } from '../services/lichess.js';
import { markNotificationSent, planLiveNotification } from '../services/notifier.js';
import { parseLiveGames } from '../utils/pgnLive.js';
import type { Logger } from '../utils/logger.js';
import type {
  LiveGameSnapshot,
  LiveMonitorJobResult,
  LiveMonitorRoundResult,
  TournamentKind,
  WorkerBindings,
} from '../types.js';

const SECTION_LABELS: Record<TournamentKind, string> = {
  open: 'Open',
  womens: "Women's",
};

export async function liveMonitorJob(
  env: WorkerBindings,
  logger: Logger,
): Promise<LiveMonitorJobResult> {
  const config = loadConfig(env as unknown as NodeJS.ProcessEnv);
  const stateStore = new RedisLiveStateStore(env);
  const lockToken = await stateStore.acquireLock();

  if (!lockToken) {
    logger.info('Live monitor skipped because another run is in progress');
    return {
      status: 'skipped',
      rounds: [],
    };
  }

  const resend = new Resend(config.resendApiKey);
  const lichess = new LichessService(
    config.lichessApiBase,
    logger,
    globalThis.fetch,
    stateStore,
  );
  const rounds: LiveMonitorRoundResult[] = [];

  try {
    const localToday = new Intl.DateTimeFormat('en-CA', {
      timeZone: config.appTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    for (const kind of ['open', 'womens'] as const) {
      try {
        const selection = await lichess.selectRoundForDate(
          kind,
          kind === 'open' ? config.openBroadcast : config.womensBroadcast,
          localToday,
          config.appTimezone,
        );

        if (!selection.round) {
          logger.info('No live round found for section', { kind });
          continue;
        }

        const pgn = await lichess.fetchRoundPgn(selection.round.id);
        const games = parseLiveGames(pgn).map<LiveGameSnapshot>((game) => ({
          ...game,
          section: SECTION_LABELS[kind],
        }));

        logger.info('Live round loaded', {
          kind,
          roundId: selection.round.id,
          roundName: selection.round.name,
          gameCount: games.length,
        });

        const result = await processGames({
          games,
          roundName: selection.round.name,
          section: SECTION_LABELS[kind],
          config,
          logger,
          resend,
          stateStore,
          lichess,
        });
        rounds.push({
          kind,
          roundId: selection.round.id,
          roundName: selection.round.name,
          gamesSeen: games.length,
          notificationsSent: result.notificationsSent,
        });
      } catch (error) {
        logger.warn('Live round fetch failed; skipping cycle', {
          kind,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await stateStore.releaseLock(lockToken);
  }

  return {
    status: 'ok',
    rounds,
  };
}

async function processGames(options: {
  games: LiveGameSnapshot[];
  roundName: string;
  section: string;
  config: ReturnType<typeof loadConfig>;
  logger: Logger;
  resend: Resend;
  stateStore: RedisLiveStateStore;
  lichess: LichessService;
}): Promise<{ notificationsSent: number }> {
  const { games, config, logger, resend, stateStore, lichess, roundName, section } =
    options;
  let notificationsSent = 0;

  const candidates = await Promise.all(
    games.map(async (game) => {
      let previousState;
      try {
        previousState = await stateStore.getState(game.gameId);
      } catch (error) {
        logger.warn('Live state load failed; skipping game', {
          gameId: game.gameId,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }

      if (previousState?.finished) {
        return null;
      }

      if (previousState && previousState.lastMoveNumber === game.moveNumber) {
        return null;
      }

      if (game.moveNumber < 8) {
        try {
          await stateStore.setState(game.gameId, {
            white: game.white,
            black: game.black,
            lastEval: previousState?.lastEval ?? null,
            lastState: previousState?.lastState ?? null,
            pendingState: previousState?.pendingState ?? null,
            consecutiveSameState: previousState?.consecutiveSameState ?? 0,
            lastNotifiedAt: previousState?.lastNotifiedAt ?? null,
            notificationsLastHour: previousState?.notificationsLastHour ?? 0,
            lastMoveNumber: game.moveNumber,
            finished: previousState?.finished ?? false,
          });
        } catch (error) {
          logger.warn('Live state save failed for opening noise; skipping game', {
            gameId: game.gameId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return null;
      }

      return { game, previousState };
    }),
  );

  const evalCandidates = candidates.filter(
    (value): value is {
      game: LiveGameSnapshot;
      previousState: Awaited<ReturnType<RedisLiveStateStore['getState']>>;
    } => value !== null,
  );

  const evaluated = await mapWithConcurrency(
    evalCandidates,
    3,
    async ({ game, previousState }) => {
      const evalCp = await lichess.fetchCloudEval(game.fen);
      if (evalCp === null) {
        return null;
      }

      return { game, previousState, evalCp };
    },
  );

  for (const item of evaluated) {
    if (!item) {
      continue;
    }

    const now = new Date();
    const plan = planLiveNotification(
      {
        ...item.game,
        roundName,
        section,
      },
      item.evalCp,
      item.previousState,
      now,
    );

    if (!plan.decision.shouldNotify || !plan.message) {
      try {
        await stateStore.setState(item.game.gameId, plan.nextState);
      } catch (error) {
        logger.warn('Live state save failed; skipping game', {
          gameId: item.game.gameId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }

    try {
      await resend.emails.send({
        from: config.emailFrom,
        to: config.emailTo,
        subject: plan.message.subject,
        text: plan.message.text,
      });
      await stateStore.setState(
        item.game.gameId,
        markNotificationSent(plan.nextState, now),
      );
      notificationsSent += 1;
      logger.info('Live notification sent', {
        gameId: item.game.gameId,
        state: plan.decision.state,
        eval: plan.decision.evalText,
        roundName,
      });
    } catch (error) {
      logger.error('Live notification send failed', {
        gameId: item.game.gameId,
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        await stateStore.setState(item.game.gameId, plan.nextState);
      } catch (stateError) {
        logger.warn('Live state save failed after send failure', {
          gameId: item.game.gameId,
          error: stateError instanceof Error ? stateError.message : String(stateError),
        });
      }
    }
  }

  return { notificationsSent };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, values.length) }, () =>
    worker(),
  );

  await Promise.all(workers);
  return results;
}
