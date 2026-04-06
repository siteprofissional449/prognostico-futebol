export type PlanType = 'FREE' | 'PREMIUM' | 'VIP';

export interface Prediction {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  startTime: string;
  market: string;
  probability: number;
  odd: number;
  minPlan: PlanType;
  predictionDate: string;
}

export type BillingPeriod = 'WEEKLY' | 'MONTHLY';

export interface Plan {
  id: string;
  code: string;
  name: string;
  /** Valor por período de cobrança */
  price: number;
  billingPeriod: BillingPeriod;
}

export interface LoginResponse {
  access_token: string;
  plan: PlanType;
  isAdmin: boolean;
}

export interface AdminStats {
  userCount: number;
  predictionCount: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  isAdmin: boolean;
  planExpiresAt: string | null;
  createdAt: string;
  currentPlan: { id: string; code: string; name: string } | null;
}

export type PrognosticStatus = 'PENDING' | 'WON' | 'LOST';

export interface AdminPrognostic {
  id: string;
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  odd: number;
  matchDate: string;
  status: PrognosticStatus;
  plan: PlanType;
  analysis: string | null;
  createdAt: string;
}

export interface AdminPrognosticPayload {
  homeTeam: string;
  awayTeam: string;
  prediction: string;
  odd: number;
  matchDate: string;
  status?: PrognosticStatus;
  plan?: PlanType;
  analysis?: string | null;
}

export interface UserInfo {
  plan: PlanType;
  email?: string;
}

/** Resultado de partida (finalizada) */
export interface MatchResult {
  id: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  leagueCode?: string;
  utcDate: string;
  homeScore: number;
  awayScore: number;
  winner: 'HOME' | 'DRAW' | 'AWAY';
  halfTime?: { home: number; away: number };
}

/** Detalhe do jogo (para estatísticas) */
export interface MatchDetail extends MatchResult {
  status: string;
  minute?: number;
  stage?: string;
}
