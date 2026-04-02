import type { ParsedGameResult } from '../types.js';

const RESULT_TO_SCORE: Record<ParsedGameResult['result'], string> = {
  '1-0': '1 - 0',
  '0-1': '0 - 1',
  '1/2-1/2': '1/2 - 1/2',
};

export function parsePgnResults(pgn: string): ParsedGameResult[] {
  const games = splitGames(pgn);

  return games
    .map(parseHeaders)
    .filter((headers) => isFinishedResult(headers.Result))
    .map((headers) => {
      const result = headers.Result as ParsedGameResult['result'];
      const white = toFirstName(headers.White);
      const black = toFirstName(headers.Black);

      return {
        white,
        black,
        result,
        scoreLine: `${white} ${RESULT_TO_SCORE[result]} ${black}`,
      };
    });
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

function isFinishedResult(result?: string): result is ParsedGameResult['result'] {
  return result === '1-0' || result === '0-1' || result === '1/2-1/2';
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
