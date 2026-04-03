import type {
  LiveEvalBucket,
  LiveEvalTrend,
  LiveGameSnapshot,
  LiveGameState,
  LiveNotificationDecision,
  LiveNotificationMessage,
} from '../types.js';
import { bucketEval, formatEvalBucket } from '../utils/evalBucket.js';

const MIN_NOTIFICATION_INTERVAL_MS = 5 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_NOTIFICATIONS_PER_WINDOW = 3;

export interface LiveNotificationPlan {
  decision: LiveNotificationDecision;
  nextState: LiveGameState;
  message: LiveNotificationMessage | null;
}

export function planLiveNotification(
  snapshot: LiveGameSnapshot,
  currentEval: number | null,
  previousState: LiveGameState | null,
  now: Date,
): LiveNotificationPlan {
  if (snapshot.result !== '*') {
    const finishedState = buildBaseState(snapshot, previousState);
    return {
      decision: {
        shouldNotify: false,
        reason: 'finished',
        state: previousState?.lastState ?? 'equal',
        trend: 'equal',
        evalText: formatEvalText(previousState?.lastEval ?? null),
        evalDelta: 0,
        sameStateCount: previousState?.consecutiveSameState ?? 0,
      },
      nextState: {
        ...finishedState,
        finished: true,
        lastMoveNumber: snapshot.moveNumber,
      },
      message: null,
    };
  }

  if (!previousState) {
    const initialState = buildBaseState(snapshot, null);
    const state =
      currentEval === null
        ? initialState
        : {
            ...initialState,
            lastEval: currentEval,
            lastState: bucketEval(currentEval),
            pendingState: bucketEval(currentEval),
            consecutiveSameState: 1,
          };

    return {
      decision: {
        shouldNotify: false,
        reason: 'first_seen',
        state: state.lastState ?? 'equal',
        trend: 'equal',
        evalText: formatEvalText(currentEval),
        evalDelta: 0,
        sameStateCount: state.consecutiveSameState,
      },
      nextState: state,
      message: null,
    };
  }

  if (previousState.finished) {
    return {
      decision: {
        shouldNotify: false,
        reason: 'finished',
        state: previousState.lastState ?? 'equal',
        trend: 'equal',
        evalText: formatEvalText(previousState.lastEval),
        evalDelta: 0,
        sameStateCount: previousState.consecutiveSameState,
      },
      nextState: previousState,
      message: null,
    };
  }

  if (snapshot.moveNumber < 8) {
    return {
      decision: {
        shouldNotify: false,
        reason: 'opening_noise',
        state: previousState.lastState ?? 'equal',
        trend: 'equal',
        evalText: formatEvalText(previousState.lastEval),
        evalDelta: 0,
        sameStateCount: previousState.consecutiveSameState,
      },
      nextState: {
        ...previousState,
        white: snapshot.white,
        black: snapshot.black,
        lastMoveNumber: snapshot.moveNumber,
      },
      message: null,
    };
  }

  if (currentEval === null) {
    return {
      decision: {
        shouldNotify: false,
        reason: 'eval_missing',
        state: previousState.lastState ?? 'equal',
        trend: 'equal',
        evalText: formatEvalText(previousState.lastEval),
        evalDelta: 0,
        sameStateCount: previousState.consecutiveSameState,
      },
      nextState: {
        ...previousState,
        white: snapshot.white,
        black: snapshot.black,
      },
      message: null,
    };
  }

  const currentState = bucketEval(currentEval, previousState.lastState);
  const evalDelta =
    previousState.lastEval === null ? 0 : currentEval - previousState.lastEval;
  const trend = trendFromDelta(evalDelta);
  const sameStateCount =
    previousState.pendingState === currentState
      ? previousState.consecutiveSameState + 1
      : 1;
  const nextStateBase: LiveGameState = {
    ...previousState,
    white: snapshot.white,
    black: snapshot.black,
    lastEval: currentEval,
    lastState: currentState,
    pendingState: currentState,
    consecutiveSameState: sameStateCount,
    lastMoveNumber: snapshot.moveNumber,
  };

  if (sameStateCount < 2) {
    return {
      decision: {
        shouldNotify: false,
        reason: 'unstable',
        state: currentState,
        trend,
        evalText: formatEvalText(currentEval),
        evalDelta,
        sameStateCount,
      },
      nextState: nextStateBase,
      message: null,
    };
  }

  const notificationsLastHour =
    previousState.lastNotifiedAt &&
    now.getTime() - Date.parse(previousState.lastNotifiedAt) > RATE_LIMIT_WINDOW_MS
      ? 0
      : previousState.notificationsLastHour;

  const signal =
    previousState.lastState !== currentState || Math.abs(evalDelta) >= 100;

  if (!signal) {
    return {
      decision: {
        shouldNotify: false,
        reason: 'no_signal',
        state: currentState,
        trend,
        evalText: formatEvalText(currentEval),
        evalDelta,
        sameStateCount,
      },
      nextState: nextStateBase,
      message: null,
    };
  }

  if (
    previousState.lastNotifiedAt &&
    now.getTime() - Date.parse(previousState.lastNotifiedAt) <
      MIN_NOTIFICATION_INTERVAL_MS
  ) {
    return {
      decision: {
        shouldNotify: false,
        reason: 'cooldown',
        state: currentState,
        trend,
        evalText: formatEvalText(currentEval),
        evalDelta,
        sameStateCount,
      },
      nextState: nextStateBase,
      message: null,
    };
  }

  if (notificationsLastHour >= MAX_NOTIFICATIONS_PER_WINDOW) {
    return {
      decision: {
        shouldNotify: false,
        reason: 'rate_limited',
        state: currentState,
        trend,
        evalText: formatEvalText(currentEval),
        evalDelta,
        sameStateCount,
      },
      nextState: nextStateBase,
      message: null,
    };
  }

  const message = buildNotificationMessage(snapshot, currentState, trend, currentEval);

  return {
    decision: {
      shouldNotify: true,
      reason: 'notify',
      state: currentState,
      trend,
      evalText: formatEvalText(currentEval),
      evalDelta,
      sameStateCount,
    },
    nextState: nextStateBase,
    message,
  };
}

export function markNotificationSent(
  state: LiveGameState,
  now: Date,
): LiveGameState {
  const lastNotifiedAt = now.toISOString();
  const notificationsLastHour =
    state.lastNotifiedAt &&
    now.getTime() - Date.parse(state.lastNotifiedAt) <= RATE_LIMIT_WINDOW_MS
      ? state.notificationsLastHour + 1
      : 1;

  return {
    ...state,
    lastNotifiedAt,
    notificationsLastHour,
  };
}

function buildBaseState(
  snapshot: LiveGameSnapshot,
  previousState: LiveGameState | null,
): LiveGameState {
  return {
    white: snapshot.white,
    black: snapshot.black,
    lastEval: previousState?.lastEval ?? null,
    lastState: previousState?.lastState ?? null,
    pendingState: previousState?.pendingState ?? null,
    consecutiveSameState: previousState?.consecutiveSameState ?? 0,
    lastNotifiedAt: previousState?.lastNotifiedAt ?? null,
    notificationsLastHour: previousState?.notificationsLastHour ?? 0,
    lastMoveNumber: snapshot.moveNumber,
    finished: previousState?.finished ?? false,
  };
}

function buildNotificationMessage(
  snapshot: LiveGameSnapshot,
  state: LiveEvalBucket,
  trend: LiveEvalTrend,
  evalCp: number,
): LiveNotificationMessage {
  const symbol = stateToSymbol(state);
  const roundLabel =
    snapshot.roundName.replace(/^Round\s+/i, '') || snapshot.roundName;

  return {
    subject: `\u265f ${snapshot.white} ${symbol} vs ${snapshot.black} \u2014 ${formatEvalBucket(state)}`,
    text: [
      `${snapshot.white} ${symbol} vs ${snapshot.black}`,
      `${formatEvalBucket(state)} (${formatEvalText(evalCp)})`,
      `Move ${snapshot.moveNumber} \u00b7 ${snapshot.section} \u00b7 Round ${roundLabel}`,
    ].join('\n'),
  };
}

function trendFromDelta(delta: number): LiveEvalTrend {
  if (delta > 0) {
    return 'improving';
  }

  if (delta < 0) {
    return 'worsening';
  }

  return 'equal';
}

function stateToSymbol(state: LiveEvalBucket): string {
  switch (state) {
    case 'white_winning':
    case 'white_better':
      return '\u2191';
    case 'equal':
      return '\u2194';
    case 'black_better':
    case 'black_winning':
      return '\u2193';
  }
}

function formatEvalText(evalCp: number | null): string {
  if (evalCp === null) {
    return 'n/a';
  }

  if (Math.abs(evalCp) >= 9000) {
    const mate = 10000 - Math.abs(evalCp);
    const prefix = evalCp > 0 ? '' : '-';
    return `${prefix}#${mate}`;
  }

  const value = (evalCp / 100).toFixed(2);
  return evalCp > 0 ? `+${value}` : value;
}
