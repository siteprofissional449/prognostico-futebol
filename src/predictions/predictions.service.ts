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

    const days: PredictionsHistoryDayDto[] = [];
    const sortedDates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));
    for (const d of sortedDates) {
      const list = (byDate.get(d) || []).filter(
        (p) => !this.isPlaceholderMockPrediction(p),
      );
      if (list.length === 0) continue;
      const results = await this.loadResultsForDate(d);
      const items = list.map((p, idx) => this.toViewDto(p, idx, access, results));
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
