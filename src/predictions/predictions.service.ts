import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Prediction, PlanType } from './prediction.entity';
import {
  PredictionsHistoryDayDto,
  PredictionsHistoryResponseDto,
  PredictionViewDto,
  PredictionsListMetaDto,
  PredictionsListResponseDto,
} from './dto/prediction-view.dto';
import { FootballService, MatchResultDto } from '../football/football.service';
import { UserAccessContext } from '../users/users.service';
import {
  Prognostic,
  PrognosticPlan,
  PrognosticStatus,
} from '../prognostic/prognostic.entity';

const PROG_PLAN_TIER: Record<PrognosticPlan, number> = {
  [PrognosticPlan.FREE]: 0,
  [PrognosticPlan.DAILY]: 1,
  [PrognosticPlan.WEEKLY]: 2,
  [PrognosticPlan.PREMIUM]: 3,
};

function prognosticMinTierForUser(plan: PrognosticPlan): number {
  return PROG_PLAN_TIER[plan] ?? PROG_PLAN_TIER[PrognosticPlan.PREMIUM];
}

const PLAN_ORDER: Record<PlanType, number> = {
  [PlanType.FREE]: 0,
  [PlanType.DAILY]: 1,
  [PlanType.WEEKLY]: 2,
  [PlanType.MONTHLY]: 3,
  [PlanType.PREMIUM]: 3,
};

/** Jogos com palpite completo para visitante FREE (ranking por qualidade). */
export const FREE_PREDICTION_SLOTS = 5;

/** Teaser na home: melhores jogos do dia. */
export const HOME_PREDICTION_TEASERS = 3;

const HISTORY_MAX_SPAN_DAYS = 90;

@Injectable()
export class PredictionsService {
  private readonly logger = new Logger(PredictionsService.name);

  constructor(
    @InjectRepository(Prediction)
    private readonly predictionRepo: Repository<Prediction>,
    @InjectRepository(Prognostic)
    private readonly prognosticRepo: Repository<Prognostic>,
    @Inject(forwardRef(() => FootballService))
    private readonly footballService: FootballService,
  ) {}

  /**
   * Ranking do dia: maior confiança (probability) primeiro, depois odd mais alta
   * (valor / “mais interessante” como desempate).
   */
  async findRankedForDate(date: string): Promise<Prediction[]> {
    return this.predictionRepo.find({
      where: { predictionDate: date },
      order: {
        probability: 'DESC',
        odd: 'DESC',
        createdAt: 'ASC',
      },
    });
  }

  private toViewDto(
    entity: Prediction,
    rankIndex: number,
    access: UserAccessContext,
    resultsByMatch: Map<string, MatchResultDto>,
  ): PredictionViewDto {
    const isPremium = rankIndex >= FREE_PREDICTION_SLOTS;
    const locked =
      access.userAccessTier === 0 ? isPremium : false;
    const prob = entity.probability != null ? Number(entity.probability) : null;
    const odd = entity.odd != null ? Number(entity.odd) : null;

    const dto = new PredictionViewDto();
    dto.id = entity.id;
    dto.matchId = entity.matchId;
    dto.homeTeam = entity.homeTeam;
    dto.awayTeam = entity.awayTeam;
    dto.league = entity.league;
    dto.startTime =
      entity.startTime instanceof Date
        ? entity.startTime.toISOString()
        : String(entity.startTime);
    dto.predictionDate = entity.predictionDate;
    dto.minPlan = entity.minPlan;

    if (locked) {
      dto.market = null;
      dto.probability = null;
      dto.odd = null;
      dto.probHome = null;
      dto.probDraw = null;
      dto.probAway = null;
      dto.bestBet = null;
      dto.analysis = null;
      dto.confidence = null;
    } else {
      dto.market = entity.market;
      dto.probability = prob;
      dto.odd = odd;
      dto.probHome =
        entity.probHome != null ? Number(entity.probHome) : null;
      dto.probDraw =
        entity.probDraw != null ? Number(entity.probDraw) : null;
      dto.probAway =
        entity.probAway != null ? Number(entity.probAway) : null;
      dto.bestBet = entity.bestBet;
      dto.analysis = entity.analysis;
      dto.confidence = prob;
    }

    dto.isPremium = isPremium;
    dto.locked = locked;
    dto.finalScore = null;
    dto.resultStatus = null;

    if (access.userAccessTier >= PLAN_ORDER[PlanType.WEEKLY]) {
      const result = resultsByMatch.get(String(entity.matchId));
      if (!result) {
        dto.resultStatus = 'PENDING';
      } else {
        dto.finalScore = `${result.homeScore}x${result.awayScore}`;
        const totalGoals = result.homeScore + result.awayScore;
        dto.resultStatus = this.computeResultStatus(
          dto.market,
          result.winner,
          totalGoals,
        );
      }
    }

    return dto;
  }

  private computeResultStatus(
    market: string | null,
    winner: MatchResultDto['winner'],
    totalGoals: number,
  ): 'GREEN' | 'RED' | 'PENDING' {
    if (!market) return 'PENDING';
    if (market === 'OVER_25' || market === 'OVER_2') {
      if (!Number.isFinite(totalGoals)) return 'PENDING';
      return totalGoals > 2 ? 'GREEN' : 'RED';
    }
    if (market === 'UNDER_25') {
      if (!Number.isFinite(totalGoals)) return 'PENDING';
      return totalGoals < 3 ? 'GREEN' : 'RED';
    }
    if (market === 'CORNERS_OVER' || market === 'CORNERS_UNDER') {
      return 'PENDING';
    }
    if (market !== 'HOME_WIN' && market !== 'AWAY_WIN' && market !== 'DRAW') {
      return 'PENDING';
    }
    const predicted =
      market === 'HOME_WIN' ? 'HOME' : market === 'AWAY_WIN' ? 'AWAY' : 'DRAW';
    return predicted === winner ? 'GREEN' : 'RED';
  }

  private async loadResultsForDate(date: string): Promise<Map<string, MatchResultDto>> {
    try {
      const results = await this.footballService.getResultsOfDay(date);
      return new Map(results.map((r) => [String(r.id), r]));
    } catch (e) {
      this.logger.warn(
        `Falha ao carregar resultados de ${date}: ${e instanceof Error ? e.message : e}`,
      );
      return new Map();
    }
  }

  private matchDateToYmd(d: Date | string): string {
    const x = d instanceof Date ? d : new Date(d);
    return Number.isNaN(x.getTime()) ? this.today() : x.toISOString().slice(0, 10);
  }

  private canUserSeePrognostic(p: Prognostic, userTier: number): boolean {
    if (p.plan === PrognosticPlan.FREE) return true;
    return prognosticMinTierForUser(p.plan) <= userTier;
  }

  private progPlanToMinPlan(plan: PrognosticPlan): PlanType {
    if (plan === PrognosticPlan.DAILY) return PlanType.DAILY;
    if (plan === PrognosticPlan.WEEKLY) return PlanType.WEEKLY;
    if (plan === PrognosticPlan.PREMIUM) return PlanType.PREMIUM;
    return PlanType.FREE;
  }

  /**
   * Tenta mapear o texto do palpite manual para o mesmo formato dos automáticos
   * (para calcular green/red quando o resultado do jogo existir na API).
   */
  private inferMarketFromPrognosticText(text: string): string | null {
    const t = String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    if (!t.trim()) return null;
    if (/\b(empate|deu empate|x)\b/.test(t) && !t.includes('não em')) {
      return 'DRAW';
    }
    if (/(fora|visitante|2\s*\(fora\)|b\s*\)|vitória (do |da )?visit)/.test(t)) {
      return 'AWAY_WIN';
    }
    if (/(^|\s)(casa|mandante|1\s*\(casa\)|a\s*\))/.test(t) || t.includes('vitória da casa')) {
      return 'HOME_WIN';
    }
    if (t.includes('menos') && (t.includes('2.5') || t.includes('2,5'))) {
      return 'UNDER_25';
    }
    if (t.includes('mais de 2.5') || t.includes('mais de 2,5') || /\bover\s*2.5/.test(t)) {
      return 'OVER_25';
    }
    if (t.includes('mais de 2') && !t.includes('2.5') && !t.includes('2,5')) {
      return 'OVER_2';
    }
    if (t.includes('mais de') && (t.includes('2.5') || t.includes('2,5'))) {
      return 'OVER_25';
    }
    if (t.includes('escanteio') && t.includes('mais')) return 'CORNERS_OVER';
    if (t.includes('escanteio') && t.includes('menos')) return 'CORNERS_UNDER';
    if (t.includes('empate') && t.length < 20) return 'DRAW';
    return null;
  }

  private indexResultsByTeamPair(
    list: MatchResultDto[],
  ): Map<string, MatchResultDto> {
    const m = new Map<string, MatchResultDto>();
    for (const r of list) {
      const k = `${this.normalizeTeamLabel(r.homeTeam)}|${this.normalizeTeamLabel(r.awayTeam)}`;
      m.set(k, r);
    }
    return m;
  }

  private normalizeTeamLabel(s: string): string {
    return String(s ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9áàâãéêíóôõúç\s-]/gi, '')
      .replace(/\s+/g, ' ');
  }

  private prognosticToHistoryViewDto(
    p: Prognostic,
    rankIndex: number,
    access: UserAccessContext,
    resultsByTeam: Map<string, MatchResultDto>,
  ): PredictionViewDto {
    const isPremium = rankIndex >= FREE_PREDICTION_SLOTS;
    const locked = access.userAccessTier === 0 ? isPremium : false;
    const prob = p.probability != null ? Number(p.probability) : null;
    const oddN = p.odd != null ? Number(p.odd) : null;
    const minPlan = this.progPlanToMinPlan(p.plan);
    const inferred = this.inferMarketFromPrognosticText(p.prediction);
    const displayMarket = inferred ?? p.prediction;

    const dto = new PredictionViewDto();
    dto.id = `manual-${p.id}`;
    dto.matchId = `manual-${p.id}`;
    dto.homeTeam = p.homeTeam;
    dto.awayTeam = p.awayTeam;
    dto.league = 'Prognóstico manual';
    dto.startTime = new Date(p.matchDate).toISOString();
    dto.predictionDate = this.matchDateToYmd(p.matchDate);
    dto.minPlan = minPlan;

    if (locked) {
      dto.market = null;
      dto.probability = null;
      dto.odd = null;
      dto.probHome = null;
      dto.probDraw = null;
      dto.probAway = null;
      dto.bestBet = null;
      dto.analysis = null;
      dto.confidence = null;
    } else {
      dto.market = displayMarket;
      dto.probability = prob;
      dto.odd = oddN;
      dto.probHome = null;
      dto.probDraw = null;
      dto.probAway = null;
      dto.bestBet = inferred ?? p.prediction;
      dto.analysis = p.analysis;
      dto.confidence = prob;
    }

    dto.isPremium = isPremium;
    dto.locked = locked;
    dto.finalScore = null;
    dto.resultStatus = null;

    if (access.userAccessTier < PLAN_ORDER[PlanType.WEEKLY]) {
      return dto;
    }

    const k = `${this.normalizeTeamLabel(p.homeTeam)}|${this.normalizeTeamLabel(p.awayTeam)}`;
    const result = resultsByTeam.get(k);

    if (p.status === PrognosticStatus.WON) {
      dto.resultStatus = 'GREEN';
      if (result) dto.finalScore = `${result.homeScore}x${result.awayScore}`;
    } else if (p.status === PrognosticStatus.LOST) {
      dto.resultStatus = 'RED';
      if (result) dto.finalScore = `${result.homeScore}x${result.awayScore}`;
    } else if (result) {
      dto.finalScore = `${result.homeScore}x${result.awayScore}`;
      const totalGoals = result.homeScore + result.awayScore;
      if (inferred) {
        dto.resultStatus = this.computeResultStatus(
          inferred,
          result.winner,
          totalGoals,
        );
      } else {
        dto.resultStatus = 'PENDING';
      }
    } else {
      dto.resultStatus = 'PENDING';
    }

    return dto;
  }

  private normalizeDate(input?: string): string {
    if (!input) return this.today();
    const trimmed = input.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return this.today();
    return trimmed;
  }

  /**
   * Partidas fictícias do `FootballService.getMockMatches` (Time A, Time B, …)
   * quando não há `FOOTBALL_API_KEY`. Aceita também "Tempo A" (ex.: UI ou dados antigos).
   */
  private isPlaceholderMockPrediction(p: Prediction): boolean {
    const looksMock = (name: string) => {
      const s = String(name ?? '').trim();
      return /^Time\s+[A-Z]$/i.test(s) || /^Tempo\s+[A-Z]$/i.test(s);
    };
    return looksMock(p.homeTeam) || looksMock(p.awayTeam);
  }

  private resolveEffectiveDate(
    requestedDate: string,
    access: UserAccessContext,
  ): string {
    const today = this.today();
    if (access.userAccessTier < PLAN_ORDER[PlanType.WEEKLY]) {
      return today;
    }
    return requestedDate;
  }

  async listWithAccess(
    access: UserAccessContext,
    date?: string,
  ): Promise<PredictionsListResponseDto> {
    const requestedDate = this.normalizeDate(date);
    const effectiveDate = this.resolveEffectiveDate(requestedDate, access);
    const ranked = await this.findRankedForDate(effectiveDate);
    const rankedFiltered = ranked.filter(
      (p) => !this.isPlaceholderMockPrediction(p),
    );
    const resultsByMatch =
      access.userAccessTier >= PLAN_ORDER[PlanType.WEEKLY]
        ? await this.loadResultsForDate(effectiveDate)
        : new Map<string, MatchResultDto>();
    const items = rankedFiltered.map((p, idx) =>
      this.toViewDto(p, idx, access, resultsByMatch),
    );
    const meta = new PredictionsListMetaDto();
    meta.total = rankedFiltered.length;
    meta.freeSlotCount = FREE_PREDICTION_SLOTS;
    meta.homeTeaserCount = HOME_PREDICTION_TEASERS;
    meta.requestedDate = requestedDate;
    meta.effectiveDate = effectiveDate;
    meta.userAccessTier = access.userAccessTier;
    meta.plan = access.plan;
    meta.canAccessHistory = access.canAccessHistory;
    meta.canAccessPastResults = access.canAccessPastResults;
    const body = new PredictionsListResponseDto();
    body.items = items;
    body.meta = meta;
    return body;
  }

  async listHomeTeasers(date?: string): Promise<PredictionsListResponseDto> {
    const targetDate = this.normalizeDate(date);
    const ranked = await this.findRankedForDate(targetDate);
    const realRanked = ranked.filter((p) => !this.isPlaceholderMockPrediction(p));
    const slice = realRanked.slice(0, HOME_PREDICTION_TEASERS);
    const freeAccess: UserAccessContext = {
      plan: PlanType.FREE,
      userAccessTier: 0,
      expiresAt: null,
      isPremium: false,
      canAccessHistory: false,
      canAccessPastResults: false,
    };
    const items = slice.map((p, idx) => {
      const dto = this.toViewDto(p, idx, freeAccess, new Map());
      dto.isPremium = false;
      dto.locked = false;
      return dto;
    });
    const meta = new PredictionsListMetaDto();
    meta.total = realRanked.length;
    meta.freeSlotCount = FREE_PREDICTION_SLOTS;
    meta.homeTeaserCount = HOME_PREDICTION_TEASERS;
    meta.requestedDate = targetDate;
    meta.effectiveDate = targetDate;
    meta.userAccessTier = 0;
    meta.plan = PlanType.FREE;
    meta.canAccessHistory = false;
    meta.canAccessPastResults = false;
    const body = new PredictionsListResponseDto();
    body.items = items;
    body.meta = meta;
    return body;
  }

  async listHistoryWithAccess(
    access: UserAccessContext,
    from?: string,
    to?: string,
  ): Promise<PredictionsHistoryResponseDto> {
    const today = this.today();
    const { rangeFrom, rangeTo } = this.resolveHistoryRange(today, from, to);

    const rows = await this.predictionRepo.find({
      where: {
        predictionDate: Between(rangeFrom, rangeTo),
      },
      order: {
        predictionDate: 'DESC',
        probability: 'DESC',
        odd: 'DESC',
      },
    });

    const byDate = new Map<string, Prediction[]>();
    for (const row of rows) {
      if (row.predictionDate >= today) continue;
      const arr = byDate.get(row.predictionDate) || [];
      arr.push(row);
      byDate.set(row.predictionDate, arr);
    }

    const progRows = await this.prognosticRepo
      .createQueryBuilder('g')
      .where('CAST(g.matchDate AS DATE) >= :from', { from: rangeFrom })
      .andWhere('CAST(g.matchDate AS DATE) <= :to', { to: rangeTo })
      .orderBy('g.matchDate', 'DESC')
      .getMany();

    const byDateProg = new Map<string, Prognostic[]>();
    for (const g of progRows) {
      const d = this.matchDateToYmd(g.matchDate);
      if (d >= today) continue;
      if (!this.canUserSeePrognostic(g, access.userAccessTier)) continue;
      const arr = byDateProg.get(d) || [];
      arr.push(g);
      byDateProg.set(d, arr);
    }

    const dateKeys = new Set<string>([...byDate.keys(), ...byDateProg.keys()]);
    const sortedDates = [...dateKeys].sort((a, b) => (a < b ? 1 : -1));

    const days: PredictionsHistoryDayDto[] = [];
    for (const d of sortedDates) {
      const list = (byDate.get(d) || []).filter(
        (p) => !this.isPlaceholderMockPrediction(p),
      );
      const progList = byDateProg.get(d) || [];
      if (list.length === 0 && progList.length === 0) continue;

      const resultsMap = await this.loadResultsForDate(d);
      const resultsList = [...resultsMap.values()];
      const resultsByTeam = this.indexResultsByTeamPair(resultsList);

      type Row =
        | { kind: 'pred'; p: Prediction; sort: number }
        | { kind: 'prog'; p: Prognostic; sort: number };
      const merged: Row[] = [
        ...list.map((p) => ({
          kind: 'pred' as const,
          p,
          sort: Number(p.probability ?? 0) * 1000 + Number(p.odd ?? 0),
        })),
        ...progList.map((p) => ({
          kind: 'prog' as const,
          p,
          sort: Number(p.probability ?? 0) * 1000 + Number(p.odd ?? 0),
        })),
      ];
      merged.sort((a, b) => b.sort - a.sort);

      const items: PredictionViewDto[] = merged.map((row, idx) =>
        row.kind === 'pred'
          ? this.toViewDto(row.p, idx, access, resultsMap)
          : this.prognosticToHistoryViewDto(row.p, idx, access, resultsByTeam),
      );

      const day = new PredictionsHistoryDayDto();
      day.date = d;
      day.items = items;
      days.push(day);
    }

    return {
      days,
      meta: {
        from: rangeFrom,
        to: rangeTo,
        userAccessTier: access.userAccessTier,
        plan: access.plan,
      },
    };
  }

  async saveMany(predictions: Partial<Prediction>[]): Promise<Prediction[]> {
    const entities = this.predictionRepo.create(predictions);
    return this.predictionRepo.save(entities);
  }

  async saveOne(partial: Partial<Prediction>): Promise<Prediction> {
    const entity = this.predictionRepo.create(partial);
    return this.predictionRepo.save(entity);
  }

  /** Evita duplicar o mesmo mercado no mesmo jogo e dia. */
  async existsForMatchMarketOnDate(
    matchId: string,
    predictionDate: string,
    market: string,
  ): Promise<boolean> {
    const n = await this.predictionRepo.count({
      where: { matchId, predictionDate, market },
    });
    return n > 0;
  }

  /** No máximo um palpite 1X2 por jogo/dia. */
  async exists1x2ForMatchOnDate(
    matchId: string,
    predictionDate: string,
  ): Promise<boolean> {
    const n = await this.predictionRepo.count({
      where: {
        matchId,
        predictionDate,
        market: In(['HOME_WIN', 'DRAW', 'AWAY_WIN']),
      },
    });
    return n > 0;
  }

  /** Já existe palpite OVER_25 ou OVER_2 para o jogo neste dia. */
  async existsAnyOverGoalsLine(
    matchId: string,
    predictionDate: string,
  ): Promise<boolean> {
    const n = await this.predictionRepo.count({
      where: {
        matchId,
        predictionDate,
        market: In(['OVER_25', 'OVER_2']),
      },
    });
    return n > 0;
  }

  /** @deprecated Prefer existsForMatchMarketOnDate — mantido para scripts legados. */
  async existsForMatchOnDate(
    matchId: string,
    predictionDate: string,
  ): Promise<boolean> {
    const n = await this.predictionRepo.count({
      where: { matchId, predictionDate },
    });
    return n > 0;
  }

  async clearByDate(date: string): Promise<void> {
    await this.predictionRepo.delete({ predictionDate: date });
  }

  private parseYmdStrict(label: string, value: string): string {
    const s = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      throw new BadRequestException(`${label} deve ser YYYY-MM-DD`);
    }
    const d = new Date(`${s}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${label} inválida`);
    }
    if (d.toISOString().slice(0, 10) !== s) {
      throw new BadRequestException(`${label} inválida`);
    }
    return s;
  }

  private daysInclusiveUtc(from: string, to: string): number {
    const a = new Date(`${from}T12:00:00.000Z`).getTime();
    const b = new Date(`${to}T12:00:00.000Z`).getTime();
    return Math.floor((b - a) / 86400000) + 1;
  }

  private resolveHistoryRange(
    today: string,
    from?: string,
    to?: string,
  ): { rangeFrom: string; rangeTo: string } {
    const rangeToParsed = to?.trim()
      ? this.parseYmdStrict('to', to)
      : today;
    if (rangeToParsed > today) {
      throw new BadRequestException('to não pode ser posterior a hoje');
    }

    const defaultFrom = new Date(`${today}T12:00:00.000Z`);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 7);
    const computedFrom = defaultFrom.toISOString().slice(0, 10);

    const rangeFromParsed = from?.trim()
      ? this.parseYmdStrict('from', from)
      : computedFrom;

    if (rangeFromParsed > rangeToParsed) {
      throw new BadRequestException('from não pode ser posterior a to');
    }

    const span = this.daysInclusiveUtc(rangeFromParsed, rangeToParsed);
    if (span > HISTORY_MAX_SPAN_DAYS) {
      throw new BadRequestException(
        `Intervalo máximo: ${HISTORY_MAX_SPAN_DAYS} dias`,
      );
    }

    return { rangeFrom: rangeFromParsed, rangeTo: rangeToParsed };
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
