import 'dotenv/config';

import { loadConfig } from '../config/env.js';
import { buildDigestPayload } from '../services/digest.js';
import { LichessService } from '../services/lichess.js';
import { ResendMailSender } from '../services/mailer.js';
import { parsePgnResults } from '../services/pgn.js';
import { logger } from '../utils/logger.js';
import type { TournamentDigestSection } from '../types.js';

const ROUND_1_DEFAULTS = {
  open: {
    roundId: 'uLCZwqAK',
    tournamentName: 'FIDE Candidates 2026: Open',
  },
  womens: {
    roundId: 'diPdGkEA',
    tournamentName: 'FIDE Candidates 2026: Women',
  },
} as const;

async function main(): Promise<void> {
  const config = loadConfig();
  const lichess = new LichessService(config.lichessApiBase, logger);
  const mailSender = new ResendMailSender(
    config.resendApiKey,
    config.emailFrom,
    config.emailTo,
  );

  const sections = await Promise.all([
    buildSection(
      lichess,
      'open',
      process.env.TEST_OPEN_ROUND_ID ?? ROUND_1_DEFAULTS.open.roundId,
      ROUND_1_DEFAULTS.open.tournamentName,
    ),
    buildSection(
      lichess,
      'womens',
      process.env.TEST_WOMENS_ROUND_ID ?? ROUND_1_DEFAULTS.womens.roundId,
      ROUND_1_DEFAULTS.womens.tournamentName,
    ),
  ]);

  const nonEmptySections = sections.filter((section) => section.results.length > 0);
  if (nonEmptySections.length === 0) {
    throw new Error('Round 1 test email has no finished games to send.');
  }

  const payload = buildDigestPayload('2026-round-1-test', nonEmptySections);
  payload.subject = `[TEST] ${payload.subject}`;

  logger.info('Sending round 1 test email', {
    to: config.emailTo,
    from: config.emailFrom,
    subject: payload.subject,
    openRoundId: sections.find((section) => section.kind === 'open')?.roundId,
    womensRoundId: sections.find((section) => section.kind === 'womens')?.roundId,
  });

  await mailSender.sendDigest(payload);

  logger.info('Round 1 test email sent successfully', {
    to: config.emailTo,
    subject: payload.subject,
  });
}

async function buildSection(
  lichess: LichessService,
  kind: 'open' | 'womens',
  roundId: string,
  tournamentName: string,
): Promise<TournamentDigestSection> {
  const pgn = await lichess.fetchRoundPgn(roundId);
  const results = parsePgnResults(pgn);

  return {
    kind,
    tournamentName,
    roundId,
    roundName: 'Round 1',
    results,
  };
}

main().catch((error) => {
  logger.error('Round 1 test email failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
