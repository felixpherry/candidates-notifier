import { describe, expect, it, vi } from 'vitest';

import { LichessService } from '../src/services/lichess.js';

describe('LichessService live helpers', () => {
  it('returns null for cloud eval 404s', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('not found', {
        status: 404,
      }),
    );

    const service = new LichessService(
      'https://lichess.org/api',
      {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
      fetchImpl,
    );

    await expect(service.fetchCloudEval('startpos')).resolves.toBeNull();
  });
});
