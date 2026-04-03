import 'dotenv/config';

import { Chess } from 'chess.js';
import { Resend } from 'resend';

import { loadConfig } from '../config/env.js';
import { LichessService } from '../services/lichess.js';
import { planLiveNotification } from '../services/notifier.js';
import { bucketEval } from '../utils/evalBucket.js';
import { extractGameId } from '../utils/pgnLive.js';
import { logger } from '../utils/logger.js';
import type { LiveGameSnapshot, LiveGameState } from '../types.js';

const DEFAULTS = {
  roundId: 'MDv2BlCp',
  roundName: 'Round 4',
  white: 'Zhu Jiner',
  black: 'Divya Deshmukh',
  moveNumber: 25,
  section: "Women's",
} as const;

async function main(): Promise<void> {
  const config = loadConfig({
    ...process.env,
    OPEN_BROADCAST_URL_OR_ID: process.env.OPEN_BROADCAST_URL_OR_ID ?? 'unused',
    WOMENS_BROADCAST_URL_OR_ID:
      process.env.WOMENS_BROADCAST_URL_OR_ID ?? 'unused',
  });
  const lichess = new LichessService(config.lichessApiBase, logger);
  const resend = new Resend(config.resendApiKey);

  const roundId = process.env.TEST_LIVE_ROUND_ID ?? DEFAULTS.roundId;
  const white = process.env.TEST_LIVE_WHITE ?? DEFAULTS.white;
  const black = process.env.TEST_LIVE_BLACK ?? DEFAULTS.black;
  const moveNumber = Number.parseInt(
    process.env.TEST_LIVE_MOVE_NUMBER ?? String(DEFAULTS.moveNumber),
    10,
  );
  const section = process.env.TEST_LIVE_SECTION ?? DEFAULTS.section;
  const roundName = process.env.TEST_LIVE_ROUND_NAME ?? DEFAULTS.roundName;

  const pgn = await lichess.fetchRoundPgn(roundId);
  const match = findGamePgn(pgn, white, black);
  if (!match) {
    throw new Error(`Could not find ${white} vs ${black} in round ${roundId}.`);
  }

  const { rawGame, headers } = match;
  const fen = fenAfterMoveNumber(rawGame, moveNumber);
  const evalCp = await lichess.fetchCloudEval(fen);
  if (evalCp === null) {
    throw new Error('Cloud eval returned no result for the selected position.');
  }

  const snapshot: LiveGameSnapshot = {
    gameId: extractGameId(headers.Site) ?? `${roundId}:${white}:${black}`,
    white: toFirstName(headers.White),
    black: toFirstName(headers.Black),
    result: process.env.TEST_LIVE_RESULT ?? '*',
    moveNumber,
    fen,
    roundName,
    section,
  };

  const currentState = bucketEval(evalCp);
  const previousState: LiveGameState = {
    white,
    black,
    lastEval: evalCp - 150,
    lastState: bucketEval(evalCp - 150),
    pendingState: currentState,
    consecutiveSameState: 1,
    lastNotifiedAt: null,
    notificationsLastHour: 0,
    lastMoveNumber: moveNumber - 1,
    finished: false,
  };

  const plan = planLiveNotification(snapshot, evalCp, previousState, new Date());
  if (!plan.decision.shouldNotify || !plan.message) {
    throw new Error(`Expected a notification plan, got ${plan.decision.reason}.`);
  }

  logger.info('Sending live eval test email', {
    roundId,
    roundName,
    game: `${white} vs ${black}`,
    moveNumber,
    fen,
    eval: plan.decision.evalText,
    subject: plan.message.subject,
  });

  await resend.emails.send({
    from: config.emailFrom,
    to: config.emailTo,
    subject: plan.message.subject,
    text: plan.message.text,
  });

  logger.info('Live eval test email sent successfully', {
    to: config.emailTo,
    subject: plan.message.subject,
  });
}

function findGamePgn(
  pgn: string,
  white: string,
  black: string,
): { rawGame: string; headers: Record<string, string> } | null {
  const expectedWhite = normalizeName(white);
  const expectedBlack = normalizeName(black);

  for (const game of splitGames(pgn)) {
    const headers = parseHeaders(game);
    const actualWhite = normalizeName(headers.White);
    const actualBlack = normalizeName(headers.Black);
    if (
      (actualWhite === expectedWhite && actualBlack === expectedBlack) ||
      (actualWhite === expectedBlack && actualBlack === expectedWhite)
    ) {
      return { rawGame: game, headers };
    }
  }

  return null;
}

function fenAfterMoveNumber(gamePgn: string, moveNumber: number): string {
  const chess = new Chess();
  chess.loadPgn(stripComments(gamePgn), { strict: false, newlineChar: '\n' });

  const history = chess.history({ verbose: true });
  const targetPlies = moveNumber * 2 - 1;
  const replay = new Chess();

  for (const move of history.slice(0, targetPlies)) {
    const applied = replay.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });

    if (!applied) {
      throw new Error(`Could not replay move ${move.san}.`);
    }
  }

  return replay.fen();
}

function stripComments(pgn: string): string {
  return pgn.replace(/\{[^}]*\}/g, '');
}

function splitGames(pgn: string): string[] {
  return pgn
    .trim()
    .split(/\r?\n\r?\n(?=\[Event|\[Site|\[Round|\[White)/)
    .map((game) => game.trim())
    .filter(Boolean);
}

function parseHeaders(game: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const matches = game.matchAll(/^\[(\w+)\s+"(.*)"\]$/gm);

  for (const match of matches) {
    headers[match[1]] = match[2];
  }

  return headers;
}

function toFirstName(name?: string): string {
  if (!name) {
    return 'Unknown';
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return 'Unknown';
  }

  if (trimmed.includes(',')) {
    const [, givenNames = ''] = trimmed.split(',', 2);
    const firstGivenName = givenNames.trim().split(/\s+/)[0];
    return firstGivenName || trimmed;
  }

  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function normalizeName(name?: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

main().catch((error) => {
  logger.error('Live eval test email failed', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
