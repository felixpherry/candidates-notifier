import { Chess } from 'chess.js';

export interface ParsedLiveGame {
  gameId: string;
  white: string;
  black: string;
  result: string;
  moveNumber: number;
  fen: string;
  roundName: string;
}

export function parseLiveGames(pgn: string): ParsedLiveGame[] {
  return splitGames(pgn)
    .map(parseGame)
    .filter((game): game is ParsedLiveGame => game !== null);
}

function splitGames(pgn: string): string[] {
  return pgn
    .trim()
    .split(/\r?\n\r?\n(?=\[Event|\[Site|\[Round|\[White)/)
    .map((game) => game.trim())
    .filter(Boolean);
}

function parseGame(game: string): ParsedLiveGame | null {
  const chess = new Chess();

  try {
    chess.loadPgn(game, { strict: false, newlineChar: '\n' });
  } catch {
    return null;
  }

  const headers = chess.getHeaders();
  const site = headers.Site ?? '';
  const gameId = extractGameId(site);
  if (!gameId) {
    return null;
  }

  const historyLength = chess.history().length;
  const moveNumber = Math.max(1, Math.ceil(historyLength / 2));

  return {
    gameId,
    white: toFirstName(headers.White),
    black: toFirstName(headers.Black),
    result: headers.Result ?? '*',
    moveNumber,
    fen: chess.fen(),
    roundName: headers.Round ?? 'Round',
  };
}

export function extractGameId(site?: string): string | null {
  const value = site?.trim() ?? '';
  if (!value) {
    return null;
  }

  const withoutQuery = value.split('?', 1)[0];
  const parts = withoutQuery.split('/').filter(Boolean);
  return parts.at(-1) ?? null;
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
