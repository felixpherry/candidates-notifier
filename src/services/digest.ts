import type {
  DigestPayload,
  TournamentDigestSection,
  TournamentKind,
} from '../types.js';

const SECTION_TITLES: Record<TournamentKind, string> = {
  open: 'Open',
  womens: "Women's",
};

const DRAW_RESULT = '1/2-1/2';
const ALL_DRAWS_MESSAGE = 'All games ended in a draw.';

export function buildDigestPayload(
  targetDate: string,
  sections: TournamentDigestSection[],
): DigestPayload {
  const firstSection = sections[0];
  const roundName = firstSection?.roundName ?? 'Round';
  const subject = `Candidates 2026 - ${roundName}`;
  const parts = [roundName];

  for (const section of sections) {
    parts.push(SECTION_TITLES[section.kind]);

    const decisiveResults = section.results.filter(
      (result) => result.result !== DRAW_RESULT,
    );

    if (decisiveResults.length === 0 && section.results.length > 0) {
      parts.push(ALL_DRAWS_MESSAGE);
    }

    for (const result of decisiveResults) {
      parts.push(result.scoreLine);
    }
  }

  return {
    subject,
    text: parts.join(' | ').trim(),
    targetDate,
    sections,
  };
}
