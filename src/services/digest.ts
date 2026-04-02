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
  const lines = [roundName, ''];

  for (const section of sections) {
    lines.push(SECTION_TITLES[section.kind]);

    const decisiveResults = section.results.filter(
      (result) => result.result !== DRAW_RESULT,
    );

    if (decisiveResults.length === 0 && section.results.length > 0) {
      lines.push(ALL_DRAWS_MESSAGE);
    }

    for (const result of decisiveResults) {
      lines.push(`| ${result.scoreLine}`);
    }

    lines.push('');
  }

  return {
    subject,
    text: lines.join('\n').trim(),
    targetDate,
    sections,
  };
}
