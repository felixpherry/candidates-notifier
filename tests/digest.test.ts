import { describe, expect, it } from 'vitest';

import { buildDigestPayload } from '../src/services/digest.js';
import type { TournamentDigestSection } from '../src/types.js';

function createSection(
  overrides: Partial<TournamentDigestSection> = {},
): TournamentDigestSection {
  return {
    kind: 'open',
    tournamentName: 'Open Candidates',
    roundName: 'Round 1',
    roundId: 'round-1',
    results: [],
    ...overrides,
  };
}

describe('buildDigestPayload', () => {
  it('includes only decisive results in the email body', () => {
    const payload = buildDigestPayload('2026-04-02', [
      createSection({
        results: [
          {
            white: 'Fabiano',
            black: 'Hikaru',
            result: '1-0',
            scoreLine: 'Fabiano 1 - 0 Hikaru',
          },
          {
            white: 'Divya',
            black: 'Anna',
            result: '1/2-1/2',
            scoreLine: 'Divya 1/2 - 1/2 Anna',
          },
        ],
      }),
    ]);

    expect(payload.text).toContain('Fabiano 1 - 0 Hikaru');
    expect(payload.text).not.toContain('Divya 1/2 - 1/2 Anna');
    expect(payload.text).not.toContain('All games ended in a draw.');
  });

  it('mentions all draws when a section has no decisive games', () => {
    const payload = buildDigestPayload('2026-04-02', [
      createSection({
        kind: 'womens',
        results: [
          {
            white: 'Divya',
            black: 'Anna',
            result: '1/2-1/2',
            scoreLine: 'Divya 1/2 - 1/2 Anna',
          },
        ],
      }),
    ]);

    expect(payload.text).toContain("Women's");
    expect(payload.text).toContain('All games ended in a draw.');
    expect(payload.text).not.toContain('Divya 1/2 - 1/2 Anna');
  });
});
