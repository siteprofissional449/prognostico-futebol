export type PlanType = 'FREE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'PREMIUM';

/** Resposta de GET /football/generation-info */
export interface GenerationInfo {
  lastAt: string | null;
  lastCount: number | null;
  scheduleDescription: string;
  /** Cache de /football/highlights. */
  footballHighlightsData?: string;
  /** Atualização de /football/live. */
  footballLiveData?: string;
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

/** Resposta de GET /auth/me (sem token novo). */
export type AuthSession = Pick<
  LoginResponse,
  'plan' | 'userAccessTier' | 'expiresAt' | 'isAdmin'
>;

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

export interface LiveMatchInfo extends MatchResult {
  status: string;
  minute: number | null;
}

/** Detalhe do jogo (para estatísticas) */
export interface MatchDetail extends MatchResult {
  status: string;
  minute?: number;
  stage?: string;
}

/** GET /football/matches/:id/prematch-analysis — dossier estatístico pré-jogo. */
export interface TeamTableRow {
  position: number | null;
  playedGames: number | null;
  points: number | null;
  won: number | null;
  draw: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  avgGoalsFor: number | null;
  avgGoalsAgainst: number | null;
}

export interface FormMatchRow {
  utcDate: string;
  opponent: string;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  result: 'W' | 'D' | 'L';
  competition: string;
}

export interface H2HMatchRow {
  utcDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface LineupPlayer {
  name: string;
  position: string | null;
  shirtNumber: number | null;
}

export interface TeamPreMatchSide {
  teamId: number | null;
  name: string;
  table: TeamTableRow | null;
  homeSplit: TeamTableRow | null;
  awaySplit: TeamTableRow | null;
  formLast5: FormMatchRow[];
  lineup: LineupPlayer[] | null;
}

export interface HeadToHeadBlock {
  matches: H2HMatchRow[];
  homeWins: number;
  draws: number;
  awayWins: number;
}

export interface AbsencePlaceholder {
  side: 'HOME' | 'AWAY';
  note: string;
}

export interface MatchPreMatchAnalysis {
  matchId: number;
  status: string | null;
  competition: string;
  competitionCode: string | null;
  home: TeamPreMatchSide;
  away: TeamPreMatchSide;
  headToHead: HeadToHeadBlock;
  absences: AbsencePlaceholder[];
  dataSourceNote: string;
}

/** Comercial ativo para o banner (carousel). */
export interface CommercialPublic {
  id: string;
  imageUrl: string;
  linkUrl: string;
  sortOrder: number;
  title?: string | null;
}

/** Comercial para gestão no admin (inclui inativos em listagem total). */
export interface CommercialAdmin extends CommercialPublic {
  active: boolean;
}
