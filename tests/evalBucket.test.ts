import { describe, expect, it } from 'vitest';

import { bucketEval } from '../src/utils/evalBucket.js';

describe('bucketEval', () => {
  it('maps centipawn values to the expected buckets', () => {
    expect(bucketEval(140)).toBe('white_winning');
    expect(bucketEval(75)).toBe('white_better');
    expect(bucketEval(0)).toBe('equal');
    expect(bucketEval(-75)).toBe('black_better');
    expect(bucketEval(-140)).toBe('black_winning');
  });

  it('applies hysteresis when values move back toward equality', () => {
    expect(bucketEval(60, 'white_winning')).toBe('white_better');
    expect(bucketEval(20, 'white_better')).toBe('equal');
    expect(bucketEval(-70, 'black_winning')).toBe('black_better');
    expect(bucketEval(-20, 'black_better')).toBe('equal');
  });
});
