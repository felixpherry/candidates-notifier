import { describe, expect, it } from 'vitest';

import { markNotificationSent, planLiveNotification } from '../src/services/notifier.js';
import type { LiveGameSnapshot, LiveGameState } from '../src/types.js';

function createSnapshot(
  overrides: Partial<LiveGameSnapshot> = {},
): LiveGameSnapshot {
  return {
    gameId: 'abcdefgh',
    white: 'Fabiano',
    black: 'Hikaru',
    result: '*',
    moveNumber: 9,
    fen: 'startpos',
    roundName: 'Round 5',
    section: 'Open',
    ...overrides,
  };
}

function createState(
  overrides: Partial<LiveGameState> = {},
): LiveGameState {
  return {
    white: 'Fabiano',
    black: 'Hikaru',
    lastEval: 20,
    lastState: 'equal',
    pendingState: 'equal',
    consecutiveSameState: 1,
    lastNotifiedAt: null,
    notificationsLastHour: 0,
    lastMoveNumber: 8,
    finished: false,
    ...overrides,
  };
}

describe('planLiveNotification', () => {
  it('treats the first seen position as non-notifying', () => {
    const plan = planLiveNotification(createSnapshot(), 20, null, new Date());

    expect(plan.decision.shouldNotify).toBe(false);
    expect(plan.decision.reason).toBe('first_seen');
    expect(plan.nextState.lastEval).toBe(20);
    expect(plan.nextState.pendingState).toBe('equal');
  });

  it('notifies on a stable state transition', () => {
    const plan = planLiveNotification(
      createSnapshot(),
      130,
      createState({
        lastEval: 20,
        lastState: 'equal',
        pendingState: 'white_winning',
        consecutiveSameState: 1,
      }),
      new Date('2026-04-03T01:10:00.000Z'),
    );

    expect(plan.decision.shouldNotify).toBe(true);
    expect(plan.decision.reason).toBe('notify');
    expect(plan.message?.subject).toContain('\u266f Fabiano \u2191 vs Hikaru');
  });

  it('suppresses jitter when the state is stable but the eval did not move enough', () => {
    const plan = planLiveNotification(
      createSnapshot(),
      58,
      createState({
        lastEval: 60,
        lastState: 'white_better',
        pendingState: 'white_better',
        consecutiveSameState: 1,
      }),
      new Date('2026-04-03T01:10:00.000Z'),
    );

    expect(plan.decision.shouldNotify).toBe(false);
    expect(plan.decision.reason).toBe('no_signal');
  });

  it('honors the five minute cooldown even when the eval delta is large enough', () => {
    const plan = planLiveNotification(
      createSnapshot(),
      135,
      createState({
        lastEval: 20,
        lastState: 'equal',
        pendingState: 'white_winning',
        consecutiveSameState: 1,
        lastNotifiedAt: '2026-04-03T01:08:30.000Z',
        notificationsLastHour: 1,
      }),
      new Date('2026-04-03T01:10:00.000Z'),
    );

    expect(plan.decision.shouldNotify).toBe(false);
    expect(plan.decision.reason).toBe('cooldown');
  });

  it('increments notification counters only after a successful send', () => {
    const state = createState({
      lastNotifiedAt: '2026-04-03T01:00:00.000Z',
      notificationsLastHour: 2,
    });

    expect(markNotificationSent(state, new Date('2026-04-03T01:10:00.000Z'))).toEqual(
      expect.objectContaining({
        lastNotifiedAt: '2026-04-03T01:10:00.000Z',
        notificationsLastHour: 3,
      }),
    );
  });
});
