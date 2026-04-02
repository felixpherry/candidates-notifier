export type TournamentKind = 'open' | 'womens';

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
