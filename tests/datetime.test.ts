import { describe, expect, it } from 'vitest';

import { getTargetDate, roundMatchesDate } from '../src/utils/datetime.js';

describe('datetime helpers', () => {
  it('computes the previous WIB day from a UTC run time', () => {
    const now = new Date('2026-04-02T20:00:00.000Z');
    expect(getTargetDate(now, 'Asia/Jakarta')).toEqual({
      localToday: '2026-04-03',
      targetDate: '2026-04-02',
    });
  });

  it('matches rounds by local date in WIB', () => {
    const startsAt = Date.parse('2026-04-02T06:45:00.000Z');
    expect(roundMatchesDate(startsAt, '2026-04-02', 'Asia/Jakarta')).toBe(true);
    expect(roundMatchesDate(startsAt, '2026-04-03', 'Asia/Jakarta')).toBe(false);
  });
});
