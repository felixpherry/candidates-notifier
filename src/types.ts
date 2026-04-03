export type TournamentKind = 'open' | 'womens';
export type LiveEvalBucket =
  | 'white_winning'
  | 'white_better'
  | 'equal'
  | 'black_better'
  | 'black_winning';

export type LiveEvalTrend = 'improving' | 'worsening' | 'equal';

export interface AppConfig {
  resendApiKey: string;
  emailTo: string;
  emailFrom: string;
  lichessApiBase: string;
  cronExpression: string;
  appTimezone: string;
  openBroadcast: string;
  womensBroadcast: string;
  upstashRedisRestUrl: string;
  upstashRedisRestToken: string;
  redisKeyPrefix: string;
}

export interface WorkerBindings {
  RESEND_API_KEY: string;
  EMAIL_TO: string;
  EMAIL_FROM: string;
  LICHESS_API_BASE?: string;
  CRON_EXPRESSION?: string;
  APP_TIMEZONE?: string;
  OPEN_BROADCAST_URL_OR_ID: string;
  WOMENS_BROADCAST_URL_OR_ID: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  REDIS_KEY_PREFIX?: string;
  MANUAL_TRIGGER_TOKEN?: string;
}

export interface RoundSummary {
  id: string;
  name: string;
  slug: string;
  startsAt: number;
  finished?: boolean;
  finishedAt?: number;
  url?: string;
}

export interface ParsedGameResult {
  white: string;
  black: string;
  result: '1-0' | '0-1' | '1/2-1/2';
  scoreLine: string;
}

export interface TournamentDigestSection {
  kind: TournamentKind;
  tournamentName: string;
  roundName: string;
  roundId: string;
  results: ParsedGameResult[];
}

export interface DigestPayload {
  subject: string;
  text: string;
  targetDate: string;
  sections: TournamentDigestSection[];
}

export interface IdempotencyStore {
  has(key: string): Promise<boolean>;
  set(key: string, value: string): Promise<void>;
  disconnect(): Promise<void>;
}

export interface MailSender {
  sendDigest(payload: DigestPayload): Promise<void>;
}

export interface JobRunResult {
  status: 'sent' | 'skipped';
  reason:
    | 'email_sent'
    | 'already_sent'
    | 'no_matching_round'
    | 'no_finished_games';
  key: string;
  targetDate: string;
  roundNames: string[];
}

export interface LiveGameState {
  white: string;
  black: string;
  lastEval: number | null;
  lastState: LiveEvalBucket | null;
  pendingState: LiveEvalBucket | null;
  consecutiveSameState: number;
  lastNotifiedAt: string | null;
  notificationsLastHour: number;
  lastMoveNumber: number;
  finished: boolean;
}

export interface LiveGameSnapshot {
  gameId: string;
  white: string;
  black: string;
  result: string;
  moveNumber: number;
  fen: string;
  roundName: string;
  section: string;
}

export interface LiveNotificationMessage {
  subject: string;
  text: string;
}

export interface LiveNotificationDecision {
  shouldNotify: boolean;
  reason:
    | 'first_seen'
    | 'finished'
    | 'opening_noise'
    | 'unchanged_move'
    | 'eval_missing'
    | 'unstable'
    | 'no_signal'
    | 'cooldown'
    | 'rate_limited'
    | 'notify';
  state: LiveEvalBucket;
  trend: LiveEvalTrend;
  evalText: string;
  evalDelta: number;
  sameStateCount: number;
}

export interface LiveMonitorRoundResult {
  kind: TournamentKind;
  roundId: string;
  roundName: string;
  gamesSeen: number;
  notificationsSent: number;
}

export interface LiveMonitorJobResult {
  status: 'ok' | 'skipped';
  rounds: LiveMonitorRoundResult[];
}

export interface LiveMonitorTriggerOptions {
  roundId?: string;
  white?: string;
  black?: string;
  moveNumber?: number;
}
