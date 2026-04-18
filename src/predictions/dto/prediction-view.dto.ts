import { PlanType } from '../prediction.entity';

/** Resposta enriquecida para o app (free vs premium, slots por ranking). */
export class PredictionViewDto {
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
  probHome: number | null;
  probDraw: number | null;
  probAway: number | null;
  bestBet: string | null;
  analysis: string | null;

  /** Confiança exibível (espelha `probability` do mercado escolhido quando desbloqueado). */
  confidence: number | null;

  /** Slots 1–5 no ranking do dia = conteúdo gratuito; demais = premium. */
  isPremium: boolean;

  /** Sem JWT pago: linhas premium vêm sem palpite (só dados do jogo). */
  locked: boolean;

  finalScore: string | null;
  resultStatus: 'GREEN' | 'RED' | 'PENDING' | null;
}

export class PredictionsListMetaDto {
  total: number;
  /** Quantidade de jogos com palpite completo no plano FREE. */
  freeSlotCount: number;
  /** Quantidade exibida na home (teaser). */
  homeTeaserCount: number;
  requestedDate: string;
  effectiveDate: string;
  userAccessTier: number;
  plan: PlanType;
  canAccessHistory: boolean;
  canAccessPastResults: boolean;
}

export class PredictionsListResponseDto {
  items: PredictionViewDto[];
  meta: PredictionsListMetaDto;
}

export class PredictionsHistoryDayDto {
  date: string;
  items: PredictionViewDto[];
}

export class PredictionsHistoryResponseDto {
  days: PredictionsHistoryDayDto[];
  meta: {
    from: string;
    to: string;
    userAccessTier: number;
    plan: PlanType;
  };
}
