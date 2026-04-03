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

export function findGamePgnByPlayers(
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

export function fenAtMoveNumber(pgn: string, moveNumber: number): string {
  const chess = new Chess();
  chess.loadPgn(stripComments(pgn), { strict: false, newlineChar: '\n' });

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

function parseHeaders(game: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const matches = game.matchAll(/^\[(\w+)\s+"(.*)"\]$/gm);

  for (const match of matches) {
    headers[match[1]] = match[2];
  }

  return headers;
}

function stripComments(pgn: string): string {
  return pgn.replace(/\{[^}]*\}/g, '');
}

function normalizeName(name?: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
