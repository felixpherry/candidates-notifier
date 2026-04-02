import { describe, expect, it } from 'vitest';

import { parsePgnResults } from '../src/services/pgn.js';

const samplePgn = `
[Event "Candidates"]
[White "Player A"]
[Black "Player B"]
[Result "1-0"]

1. e4 e5 1-0

[Event "Candidates"]
[White "Player C"]
[Black "Player D"]
[Result "1/2-1/2"]

1. d4 d5 1/2-1/2

[Event "Candidates"]
[White "Caruana, Fabiano"]
[Black "Nakamura, Hikaru"]
[Result "0-1"]

1. c4 e5 0-1

[Event "Candidates"]
[White "Player E"]
[Black "Player F"]
[Result "*"]

1. Nf3 d5 *
`;

describe('parsePgnResults', () => {
  it('keeps finished decisive and drawn games, shortens names, and excludes unfinished games', () => {
    expect(parsePgnResults(samplePgn)).toEqual([
      {
        white: 'Player',
        black: 'Player',
        result: '1-0',
        scoreLine: 'Player 1 - 0 Player',
      },
      {
        white: 'Player',
        black: 'Player',
        result: '1/2-1/2',
        scoreLine: 'Player 1/2 - 1/2 Player',
      },
      {
        white: 'Fabiano',
        black: 'Hikaru',
        result: '0-1',
        scoreLine: 'Fabiano 0 - 1 Hikaru',
      },
    ]);
  });
});
