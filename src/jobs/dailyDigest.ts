import { buildDigestPayload } from '../services/digest.js';
import { parsePgnResults } from '../services/pgn.js';
import { getTargetDate } from '../utils/datetime.js';
import type {
  AppConfig,
  IdempotencyStore,
  JobRunResult,
  MailSender,
  TournamentDigestSection,
  TournamentKind,
} from '../types.js';
import type { LichessService } from '../services/lichess.js';
import type { Logger } from '../utils/logger.js';

interface DailyDigestDependencies {
  config: AppConfig;
  lichess: LichessService;
  idempotency: IdempotencyStore;
  mailSender: MailSender;
  logger: Logger;
  now?: () => Date;
}

export class DailyDigestJob {
  private readonly now: () => Date;

  constructor(private readonly deps: DailyDigestDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  async run(): Promise<JobRunResult> {
    const { config, lichess, idempotency, mailSender, logger } = this.deps;
    const { targetDate, localToday } = getTargetDate(
      this.now(),
      config.appTimezone,
    );
    const key = `${config.redisKeyPrefix}:digest:${targetDate}`;

    logger.info('Starting candidates digest job', {
      targetDate,
      localToday,
      key,
      timeZone: config.appTimezone,
    });

    const selections = await Promise.all([
      lichess.selectRoundForDate(
        'open',
        config.openBroadcast,
        targetDate,
        config.appTimezone,
      ),
      lichess.selectRoundForDate(
        'womens',
        config.womensBroadcast,
        targetDate,
        config.appTimezone,
      ),
    ]);

    const matchedSelections = selections.filter((selection) => selection.round);
    if (matchedSelections.length === 0) {
      logger.info('No matching rounds found for target date', { targetDate });
      return {
        status: 'skipped',
        reason: 'no_matching_round',
        key,
        targetDate,
        roundNames: [],
      };
    }

    if (await idempotency.has(key)) {
      logger.info('Digest already sent, skipping duplicate run', { key });
      return {
        status: 'skipped',
        reason: 'already_sent',
        key,
        targetDate,
        roundNames: matchedSelections
          .map((selection) => selection.round?.name)
          .filter((value): value is string => Boolean(value)),
      };
    }

    const sections = await this.buildSections(matchedSelections.map((selection) => ({
      kind: selection.kind,
      tournamentName: selection.tournamentName,
      roundId: selection.round!.id,
      roundName: selection.round!.name,
    })));

    const nonEmptySections = sections.filter((section) => section.results.length > 0);
    if (nonEmptySections.length === 0) {
      logger.info('No finished games found; digest will not be sent', {
        targetDate,
        roundNames: sections.map((section) => section.roundName),
      });
      return {
        status: 'skipped',
        reason: 'no_finished_games',
        key,
        targetDate,
        roundNames: sections.map((section) => section.roundName),
      };
    }

    const payload = buildDigestPayload(targetDate, nonEmptySections);
    await mailSender.sendDigest(payload);
    await idempotency.set(key, JSON.stringify({ sentAt: new Date().toISOString() }));

    logger.info('Digest email sent successfully', {
      key,
      targetDate,
      roundNames: nonEmptySections.map((section) => section.roundName),
    });

    return {
      status: 'sent',
      reason: 'email_sent',
      key,
      targetDate,
      roundNames: nonEmptySections.map((section) => section.roundName),
    };
  }

  private async buildSections(
    selections: Array<{
      kind: TournamentKind;
      tournamentName: string;
      roundId: string;
      roundName: string;
    }>,
  ): Promise<TournamentDigestSection[]> {
    return Promise.all(
      selections.map(async (selection) => {
        const pgn = await this.deps.lichess.fetchRoundPgn(selection.roundId);
        const results = parsePgnResults(pgn);

        return {
          kind: selection.kind,
          tournamentName: selection.tournamentName,
          roundId: selection.roundId,
          roundName: selection.roundName,
          results,
        };
      }),
    );
  }
}
