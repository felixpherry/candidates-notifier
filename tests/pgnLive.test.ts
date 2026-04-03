import { describe, expect, it } from 'vitest';

import { parseLiveGames } from '../src/utils/pgnLive.js';

describe('parseLiveGames', () => {
  it('parses a live PGN into game metadata and the final board position', () => {
    const games = parseLiveGames(`
[Event "Candidates"]
[Site "https://lichess.org/abcdefgh"]
[White "Caruana, Fabiano"]
[Black "Nakamura, Hikaru"]
[Round "Round 5"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *
    `);

    expect(games).toHaveLength(1);
    expect(games[0]).toEqual(
      expect.objectContaining({
        gameId: 'abcdefgh',
        white: 'Fabiano',
        black: 'Hikaru',
        result: '*',
        moveNumber: 5,
        roundName: 'Round 5',
      }),
    );
    expect(games[0].fen).toContain(' w ');
  });
});
