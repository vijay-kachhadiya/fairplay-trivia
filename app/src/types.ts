// The shapes the app reads from the live channel. Notice PublicQuestion has no
// correct answer field. That is not an oversight, it is the point: the phone is
// not given the answer while the question is open.

export type Phase =
  | 'LOBBY'
  | 'QUESTION_OPEN'
  | 'QUESTION_CLOSED'
  | 'REVEAL'
  | 'LEADERBOARD'
  | 'MATCH_END';

export interface Choice {
  id: string;
  label: string;
}

export interface PublicQuestion {
  prompt: string;
  choices: Choice[];
  index: number;
}

export interface Presence {
  name: string;
  connected: boolean;
  joinedAt?: number;
}

export interface MatchState {
  phase: Phase;
  currentQuestionId: string | null;
  currentIndex: number | null;
  totalQuestions: number;
  durationMs: number;
  serverStartAt: number | null;
  presence?: Record<string, Presence>;
}

export interface PerPlayerResult {
  choiceId: string;
  correct: boolean;
  awarded: number;
  serverElapsedMs: number;
  claimedElapsedMs: number | null;
}

export interface Reveal {
  correctChoiceId: string;
  perPlayerResult: Record<string, PerPlayerResult>;
}

export interface ScoreRow {
  uid: string;
  name: string;
  total: number;
}
