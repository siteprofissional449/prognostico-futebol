export type PlanType = 'FREE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PREMIUM';

/** Resposta de GET /football/generation-info */
export interface GenerationInfo {
  lastAt: string | null;
  lastCount: number | null;
  scheduleDescription: string;
  timezone: string;
}

/** Palpite com regras de exibição free / premium (API v2). */
export interface PredictionView {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  startTime: string;
  predictionDate: string;
  minPlan: PlanType;
  market: string | null;
  probability: number | null;
  odd: number | null;
  probHome?: number | null;
  probDraw?: number | null;
  probAway?: number | null;
  bestBet?: string | null;
  analysis?: string | null;
  confidence?: number | null;
  isPremium: boolean;
  locked: boolean;
  finalScore?: string | null;
  resultStatus?: 'GREEN' | 'RED' | 'PENDING' | null;
}

export interface PredictionsListResponse {
  items: PredictionView[];
  meta: {
    total: number;
    freeSlotCount: number;
    homeTeaserCount: number;
    requestedDate: string;
    effectiveDate: string;
    userAccessTier: number;
    plan: PlanType;
    canAccessHistory: boolean;
    canAccessPastResults: boolean;
  };
}

export interface PredictionsHistoryResponse {
  days: Array<{ date: string; items: PredictionView[] }>;
  meta: {
    from: string;
    to: string;
    userAccessTier: number;
    plan: PlanType;
  };
}

/** @deprecated Use PredictionView */
export type Prediction = PredictionView;

export type BillingPeriod = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface Plan {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  /** Valor por período de cobrança */
  price: number;
  billingPeriod: BillingPeriod;
  sortOrder?: number;
  paymentProvider?: string | null;
  paymentPriceId?: string | null;
}

export interface LoginResponse {
  access_token: string;
  plan: PlanType;
  userAccessTier: number;
  expiresAt: string | null;
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
  /** 0–1 no servidor (ex.: 0,65 = 65%). Opcional. */
  probability?: number | null;
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
  probability?: number | null;
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
