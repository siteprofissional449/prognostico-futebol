import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { PredictionsService } from '../predictions/predictions.service';
import { GenerationMeta } from './generation-meta.entity';

/** Partida com odds (football-data.org v4) — usada também na geração de prognósticos */
/** Odds compactas no próprio recurso Match (v4). */
export type ApiMatchOddsCompact = {
  homeWin?: number;
  draw?: number;
  awayWin?: number;
};

export interface ApiMatch {
  id: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  competition: { name: string };
  utcDate: string;
  status?: string;
  odds?:
    | Array<{
        market: string;
        outcomes: Array<{ name: string; odds: string }>;
      }>
    | ApiMatchOddsCompact;
  /**
   * Mantém o bloco `{ homeWin, draw, awayWin }` da listagem inicial.
   * O GET `/matches/{id}/odds` devolve várias casas — para 1×2 preferimos estas médias (mais próximas do “painel”).
   */
  oddsList1x2?: ApiMatchOddsCompact;
}

/** Partida com placar (resultado) - estrutura football-data.org v4 */
export interface ApiMatchResult {
  id: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  competition: { name: string; code?: string };
  utcDate: string;
  status: string;
  /** Minuto aproximado (ex.: 67) em jogos IN_PLAY. */
  minute?: number;
  score?: {
    fullTime?: { home: number; away: number };
    halfTime?: { home: number; away: number };
    winner?: 'HOME_TEAM' | 'DRAW' | 'AWAY_TEAM';
  };
}

/** Resposta pública para resultado do dia */
export interface MatchResultDto {
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

/** Detalhe do jogo para estatísticas (placar + resumo) */
export interface MatchDetailDto extends MatchResultDto {
  status: string;
  minute?: number;
  stage?: string;
}

/** Jogos ao vivo (placar em tempo quase real; cache no servidor, ~1–2 req/min na API). */
export interface LiveMatchViewDto extends MatchResultDto {
  status: string;
  minute: number | null;
}

/** IDs football-data.org v4 — padrão ampliado (mais jogos/dia). Sobrescreve com FOOTBALL_COMPETITION_IDS. */
const DEFAULT_COMPETITION_IDS: readonly number[] = [
  2021, // Premier League
  2014, // La Liga
  2019, // Serie A (IT)
  2002, // Bundesliga
  2015, // Ligue 1
  2001, // Champions League
  2018, // Europa League
  2013, // Brasileirão Série A (BSA)
  2017, // Primeira Liga (PT)
  2003, // Eredivisie (NL)
  2016, // Championship (ELC — Inglaterra 2ª)
];

function parseCompetitionIds(raw: string | undefined): number[] {
  if (!raw?.trim()) return [...DEFAULT_COMPETITION_IDS];
  const nums = raw
    .split(/[,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  const uniq = [...new Set(nums)];
  return uniq.length ? uniq : [...DEFAULT_COMPETITION_IDS];
}

@Injectable()
export class FootballService {
  private readonly logger = new Logger(FootballService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.football-data.org/v4';
  /** Ligas/copas usadas em destaques, ao vivo e geração de palpites. */
  private readonly competitionIds: number[];
  /** Máx. de partidas/dia a enriquecer com GET /matches/{id}/odds (cada uma = 1 pedido à API). */
  private readonly maxMatchesOddsEnrich: number;
  /** Paralelismo dentro de cada lote de enrichment de odds. */
  private readonly oddsBatchSize: number;
  /** Pausa (ms) entre lotes — útil para planos com rate limit forte (ex.: 20 req/min). */
  private readonly oddsBatchPauseMs: number;

  /** Partidas (destaques) por data: GET /football/highlights. TTL padrão 6h. */
  private scheduleByDate = new Map<
    string,
    { data: MatchResultDto[]; fetchedAt: number }
  >();
  private readonly scheduleTtlMs: number;

  /** IN_PLAY + PAUSED nas ligas configuradas. */
  private liveCache: { items: LiveMatchViewDto[]; fetchedAt: number } | null =
    null;

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => PredictionsService))
    private readonly predictionsService: PredictionsService,
    @InjectRepository(GenerationMeta)
    private readonly generationMetaRepo: Repository<GenerationMeta>,
  ) {
    this.apiKey = this.config.get<string>('FOOTBALL_API_KEY') || '';
    this.competitionIds = parseCompetitionIds(
      this.config.get<string>('FOOTBALL_COMPETITION_IDS'),
    );
    const maxOdds = Number(this.config.get<string>('FOOTBALL_MAX_ODDS_ENRICH'));
    this.maxMatchesOddsEnrich =
      Number.isFinite(maxOdds) && maxOdds > 0 ? Math.min(Math.floor(maxOdds), 500) : 220;
    const bs = Number(this.config.get<string>('FOOTBALL_ODDS_BATCH_SIZE'));
    this.oddsBatchSize =
      Number.isFinite(bs) && bs > 0 ? Math.min(Math.floor(bs), 80) : 40;
    const pause = Number(this.config.get<string>('FOOTBALL_ODDS_BATCH_PAUSE_MS'));
    this.oddsBatchPauseMs =
      Number.isFinite(pause) && pause >= 0 ? Math.min(Math.floor(pause), 120_000) : 0;
    const ttlH = Number(this.config.get<string>('FOOTBALL_SCHEDULE_CACHE_TTL_HOURS'));
    this.scheduleTtlMs =
      Number.isFinite(ttlH) && ttlH > 0
        ? ttlH * 60 * 60 * 1000
        : 6 * 60 * 60 * 1000;
    this.logger.log(
      `Football-data: ${this.competitionIds.length} competição(ões); odds até ${this.maxMatchesOddsEnrich} jogos (lotes ${this.oddsBatchSize}, pausa ${this.oddsBatchPauseMs}ms)`,
    );
  }

  private competitionsParam(): string {
    return this.competitionIds.join(',');
  }

  /** Resultados do dia (partidas finalizadas) */
  async getResultsOfDay(date?: string): Promise<MatchResultDto[]> {
    const targetDate = date || this.predictionsService.today();
    if (!this.apiKey) return this.getMockResults(targetDate);
    const matches = await this.fetchMatchesByStatus(targetDate, 'FINISHED');
    return matches.map((m) => this.toMatchResultDto(m));
  }

  /**
   * Melhores jogos do dia (estado agendado / resultados) nas ligas configuradas.
   * Usa **cache** no servidor (TTL 6h por defeito) para respeitar limites da API; o cron
   * `FOOTBALL_SCHEDULE_WARM_CRON` renova. **Não** é usada na geração de palpites (00:05).
   */
  async getTopLeaguesMatches(date?: string): Promise<MatchResultDto[]> {
    const tz = this.config.get<string>('CRON_TZ') || 'America/Sao_Paulo';
    const targetDate =
      date?.trim() || new Date().toLocaleDateString('sv-SE', { timeZone: tz });
    if (!this.apiKey) {
      return this.getMockResults(targetDate);
    }
    const hit = this.scheduleByDate.get(targetDate);
    if (hit && Date.now() - hit.fetchedAt < this.scheduleTtlMs) {
      return hit.data;
    }
    return this.fetchTopLeaguesAndCache(targetDate);
  }

  /**
   * Atualiza o cache de destaques/grade do dia (chamada pelo cron a cada 6h).
   * Uma requisição à API por dia pedido.
   */
  async warmScheduleCacheForTodayInTz(): Promise<void> {
    if (!this.apiKey) return;
    const tz = this.config.get<string>('CRON_TZ') || 'America/Sao_Paulo';
    const ymd = new Date().toLocaleDateString('sv-SE', { timeZone: tz });
    try {
      await this.fetchTopLeaguesAndCache(ymd);
      this.logger.debug(`Cache de destaques renovado: ${ymd} (${tz}).`);
    } catch (e) {
      this.logger.warn(
        `warmScheduleCache: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  private async fetchTopLeaguesAndCache(ymd: string): Promise<MatchResultDto[]> {
    const list = await this.fetchTopLeaguesFromApi(ymd);
    this.scheduleByDate.set(ymd, { data: list, fetchedAt: Date.now() });
    if (this.scheduleByDate.size > 14) {
      const oldest = [...this.scheduleByDate.keys()].sort();
      for (const k of oldest.slice(0, oldest.length - 14)) {
        this.scheduleByDate.delete(k);
      }
    }
    return list;
  }

  private async fetchTopLeaguesFromApi(ymd: string): Promise<MatchResultDto[]> {
    try {
      const comps = this.competitionsParam();
      const { data } = await axios.get<{ matches?: ApiMatchResult[] }>(
        `${this.baseUrl}/matches`,
        {
          params: { date: ymd, competitions: comps },
          headers: { 'X-Auth-Token': this.apiKey },
        },
      );
      const list = (data.matches || []).map((m) => this.toMatchResultDto(m));
      return list.sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      );
    } catch (e) {
      this.logger.warn(
        `Football-Data (highlights) falhou para ${ymd}: ${
          e instanceof Error ? e.message : e
        }`,
      );
      return [];
    }
  }

  /**
   * Jogos ao vivo (IN_PLAY e PAUSED) — **2 chamadas** à API no máximo por atualização
   * (fica dentro de 20 req/min com o resto do tráfego).
   */
  async refreshLiveMatchesFromApi(): Promise<void> {
    if (!this.apiKey) {
      this.liveCache = {
        items: [],
        fetchedAt: Date.now(),
      };
      return;
    }
    const comps = this.competitionsParam();
    const headers = { 'X-Auth-Token': this.apiKey };
    const combined: ApiMatchResult[] = [];
    for (const st of ['IN_PLAY', 'PAUSED'] as const) {
      try {
        const { data } = await axios.get<{ matches?: ApiMatchResult[] }>(
          `${this.baseUrl}/matches`,
          { params: { competitions: comps, status: st }, headers, timeout: 15000 },
        );
        combined.push(...(data.matches || []));
      } catch (e) {
        this.logger.warn(
          `Football-Data (live status=${st}): ${
            e instanceof Error ? e.message : e
          }`,
        );
      }
    }
    const byId = new Map<number, ApiMatchResult>();
    for (const m of combined) {
      byId.set(m.id, m);
    }
    const items = [...byId.values()]
      .map((m) => this.toLiveViewDto(m))
      .sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      );
    this.liveCache = { items, fetchedAt: Date.now() };
  }

  /** Resposta pública: placares ao vivo (cache; atualizado por cron a cada 1 min). */
  getLiveSnapshot(): { items: LiveMatchViewDto[]; refreshedAt: string } {
    if (!this.liveCache) {
      return { items: [], refreshedAt: new Date(0).toISOString() };
    }
    return {
      items: this.liveCache.items,
      refreshedAt: new Date(this.liveCache.fetchedAt).toISOString(),
    };
  }

  private toLiveViewDto(m: ApiMatchResult): LiveMatchViewDto {
    const base = this.toMatchResultDto(m);
    return {
      ...base,
      status: m.status,
      minute: m.minute != null && Number.isFinite(Number(m.minute)) ? Math.round(Number(m.minute)) : null,
    };
  }

  /** Detalhe de um jogo (para estatísticas/placar) */
  async getMatchDetail(matchId: number): Promise<MatchDetailDto | null> {
    if (!this.apiKey) {
      return this.getMockMatchDetail(matchId);
    }
    try {
      const { data } = await axios.get<ApiMatchResult>(
        `${this.baseUrl}/matches/${matchId}`,
        { headers: { 'X-Auth-Token': this.apiKey } },
      );
      return this.toMatchDetailDto(data);
    } catch {
      return this.getMockMatchDetail(matchId);
    }
  }

  /**
   * Jogos do dia ainda não disputados (SCHEDULED / TIMED), com odds carregadas quando possível.
   * Usado pelo job de geração de prognósticos.
   */
  async getUpcomingMatchesForDate(date: string): Promise<ApiMatch[]> {
    const raw = await this.fetchMatchesWithOdds(date);
    const terminal = new Set(['FINISHED', 'POSTPONED', 'CANCELLED', 'AWARDED']);
    const upcoming = new Set(['SCHEDULED', 'TIMED']);
    return raw.filter((m) => {
      const s = (m.status || '').toUpperCase();
      if (terminal.has(s)) return false;
      if (upcoming.has(s)) return true;
      if (!s) {
        this.logger.debug(
          `Partida ${m.id} sem campo status na resposta da API; incluída como candidata.`,
        );
        return true;
      }
      return false;
    });
  }

  /** Mapa 1X2 numérico a partir do primeiro mercado de vitória da casa disponível. */
  getOddsMap(match: ApiMatch): Record<string, number | null> {
    return this.extractOddsMap(match);
  }

  /**
   * 1X2 + totais 2.5 gols + cantos (quando a API devolve mercados com outcomes).
   * Chaves: HOME_WIN, DRAW, AWAY_WIN, OVER_25, OVER_2, UNDER_25, CORNERS_OVER, CORNERS_UNDER.
   * OVER_2 = linha "mais de 2 golos" (ex.: Over 2.0 / O2), distinta de OVER_25 (2.5).
   */
  getExtendedOddsMap(match: ApiMatch): Record<string, number | null> {
    const base = this.extractOddsMap(match);
    const out: Record<string, number | null> = {
      HOME_WIN: base.HOME_WIN,
      DRAW: base.DRAW,
      AWAY_WIN: base.AWAY_WIN,
      OVER_25: null,
      OVER_2: null,
      UNDER_25: null,
      CORNERS_OVER: null,
      CORNERS_UNDER: null,
    };
    const raw = match.odds;
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw)) return out;
    for (const book of raw) {
      const mk = String((book as { market?: string }).market || '').toUpperCase();
      type OddOut = {
        name?: string;
        odds?: unknown;
        odd?: unknown;
        price?: unknown;
      };
      const outsRow = book as {
        outcomes?: OddOut[];
        values?: OddOut[];
      };
      const outs = outsRow.outcomes ?? outsRow.values ?? [];
      for (const o of outs) {
        const label = (o.name || '').replace(/\s+/g, ' ').trim();
        const price = this.parseOutcomePrice(o);
        if (price == null) continue;
        const u = label.toUpperCase();
        const has25 = u.includes('2.5') || u.includes('2,5');
        const has15 = u.includes('1.5') || u.includes('1,5');
        const has35 = u.includes('3.5') || u.includes('3,5');
        if ((u.includes('OVER') && has25) || u === 'O2.5' || u === 'OVER2.5') {
          out.OVER_25 =
            out.OVER_25 == null ? price : Math.max(out.OVER_25, price);
        }
        if (
          !has25 &&
          !has15 &&
          !has35 &&
          (u === 'O2' ||
            u.includes('OVER 2') ||
            u.includes('OVER2') ||
            (u.includes('OVER') && u.includes(' 2') && !u.includes('2.5') && !u.includes('2,5')) ||
            (u.includes('MAIS') && u.includes('2') && !has25))
        ) {
          out.OVER_2 = out.OVER_2 == null ? price : Math.max(out.OVER_2, price);
        }
        if ((u.includes('UNDER') && has25) || u === 'U2.5' || u === 'UNDER2.5') {
          out.UNDER_25 =
            out.UNDER_25 == null ? price : Math.max(out.UNDER_25, price);
        }
        if (mk.includes('CORNER') || u.includes('CORNER')) {
          if (u.includes('OVER')) {
            out.CORNERS_OVER =
              out.CORNERS_OVER == null
                ? price
                : Math.max(out.CORNERS_OVER, price);
          }
          if (u.includes('UNDER')) {
            out.CORNERS_UNDER =
              out.CORNERS_UNDER == null
                ? price
                : Math.max(out.CORNERS_UNDER, price);
          }
        }
      }
    }
    return out;
  }

  private async fetchMatchesByStatus(
    date: string,
    status: string,
  ): Promise<ApiMatchResult[]> {
    if (!this.apiKey) return [];
    try {
      const { data } = await axios.get<{ matches?: ApiMatchResult[] }>(
        `${this.baseUrl}/matches`,
        {
          params: { date, status },
          headers: { 'X-Auth-Token': this.apiKey },
        },
      );
      const matches = data.matches || [];
      return matches.sort(
        (a, b) =>
          new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      );
    } catch (e) {
      this.logger.warn(
        `Football-Data (matches status=${status}) falhou para ${date}: ${
          e instanceof Error ? e.message : e
        }`,
      );
      return [];
    }
  }

  private toMatchResultDto(m: ApiMatchResult): MatchResultDto {
    const full = m.score?.fullTime ?? { home: 0, away: 0 };
    let winner: 'HOME' | 'DRAW' | 'AWAY' = 'DRAW';
    if (full.home > full.away) winner = 'HOME';
    else if (full.away > full.home) winner = 'AWAY';
    return {
      id: m.id,
      homeTeam: m.homeTeam.name,
      awayTeam: m.awayTeam.name,
      league: m.competition?.name ?? '—',
      leagueCode: m.competition?.code,
      utcDate: m.utcDate,
      homeScore: full.home,
      awayScore: full.away,
      winner,
      halfTime: m.score?.halfTime,
    };
  }

  private toMatchDetailDto(m: ApiMatchResult): MatchDetailDto {
    const base = this.toMatchResultDto(m);
    return {
      ...base,
      status: m.status,
      stage: m.competition?.name,
    };
  }

  private getMockResults(date: string): MatchResultDto[] {
    const base = new Date(date + 'T12:00:00Z').getTime();
    return [
      {
        id: 101,
        homeTeam: 'Manchester United',
        awayTeam: 'Liverpool',
        league: 'Premier League',
        leagueCode: 'PL',
        utcDate: new Date(base).toISOString(),
        homeScore: 2,
        awayScore: 1,
        winner: 'HOME',
        halfTime: { home: 1, away: 0 },
      },
      {
        id: 102,
        homeTeam: 'Barcelona',
        awayTeam: 'Real Madrid',
        league: 'La Liga',
        leagueCode: 'PD',
        utcDate: new Date(base + 3600000).toISOString(),
        homeScore: 1,
        awayScore: 1,
        winner: 'DRAW',
        halfTime: { home: 0, away: 1 },
      },
      {
        id: 103,
        homeTeam: 'Bayern Munich',
        awayTeam: 'Borussia Dortmund',
        league: 'Bundesliga',
        leagueCode: 'BL',
        utcDate: new Date(base + 7200000).toISOString(),
        homeScore: 3,
        awayScore: 2,
        winner: 'HOME',
        halfTime: { home: 2, away: 1 },
      },
    ];
  }

  private getMockMatchDetail(matchId: number): MatchDetailDto | null {
    const results = this.getMockResults(this.predictionsService.today());
    const r = results.find((x) => x.id === matchId) ?? results[0];
    return {
      ...r,
      status: 'FINISHED',
      stage: r.league,
    };
  }

  /** Resposta para o site: última corrida e descrição do cron. */
  async getGenerationInfo(): Promise<{
    lastAt: string | null;
    lastCount: number | null;
    /** Palpites automáticos (cron 00:05). */
    scheduleDescription: string;
    /** Cache de /football/highlights. */
    footballHighlightsData: string;
    /** Atualização de /football/live. */
    footballLiveData: string;
    timezone: string;
  }> {
    const row = await this.generationMetaRepo.findOne({
      where: { id: 'singleton' },
    });
    const tz = process.env.CRON_TZ || 'America/Sao_Paulo';
    const tzLabel =
      tz === 'America/Sao_Paulo'
        ? 'Brasília'
        : tz === 'Europe/Lisbon'
          ? 'Lisboa'
          : tz;
    const ttlH = this.scheduleTtlMs / 3600000;
    return {
      lastAt: row?.lastPredictionsAt?.toISOString() ?? null,
      lastCount: row?.lastCount ?? null,
      scheduleDescription: `Palpites: todos os dias às 00:05 (${tzLabel})`,
      footballHighlightsData: `Jogos do dia (destaques): cache no servidor, renovado a cada ${ttlH}h (ligas principais) — ligeiramente atrasado face à API; poupa cota (ex. 20 req/min).`,
      footballLiveData:
        'Ao vivo: placar e minuto atualizados a cada 1 minuto (IN_PLAY/PAUSED nas mesmas ligas; ~2 chamadas API/min).',
      timezone: tz,
    };
  }

  private async fetchMatchesWithOdds(date: string): Promise<ApiMatch[]> {
    if (!this.apiKey) {
      return this.getMockMatches(date);
    }
    try {
      const comps = this.competitionsParam();
      const { data } = await axios.get<{ matches?: ApiMatch[] }>(
        `${this.baseUrl}/matches`,
        {
          params: { date, competitions: comps },
          headers: { 'X-Auth-Token': this.apiKey },
        },
      );
      const matches = data.matches || [];
      if (matches.length === 0) {
        this.logger.warn(
          `Football-Data devolveu 0 partidas para date=${date} (ligas principais; plano free costuma exigir este filtro).`,
        );
        return [];
      }
      const cap = Math.min(matches.length, this.maxMatchesOddsEnrich);
      const slice = matches.slice(0, cap);
      const withOdds = await this.enrichMatchesOddsInBatches(slice);
      const withLoadedOdds = withOdds.filter((m) => this.hasOddsPayload(m.odds));
      if (withLoadedOdds.length === 0 && matches.length > 0) {
        this.logger.warn(
          `Football-Data: ${matches.length} partida(s) em ${date}, mas odds não carregaram (muito comum no plano free: endpoint /matches/{id}/odds). ` +
            `A geração ainda pode prosseguir com IA se OPENAI_API_KEY estiver configurada.`,
        );
        return withOdds;
      }
      if (withLoadedOdds.length < withOdds.length) {
        this.logger.warn(
          `Odds 1×2 carregadas em ${withLoadedOdds.length} de ${withOdds.length} jogos (${date}); incluindo todos para geração (IA onde faltar odd).`,
        );
      }
      /** Não filtrar só os com payload: isso limitava a N jogos se só N tivessem odds (ex.: 2 de 15). */
      return withOdds;
    } catch (e) {
      this.logger.warn(
        `Football-Data (matches+odds) falhou para ${date}: ${
          e instanceof Error ? e.message : e
        }`,
      );
      return [];
    }
  }

  /** Varre odds em paralelo por lotes; pausa opcional entre lotes para não rebentar quotas da API. */
  private async enrichMatchesOddsInBatches(matches: ApiMatch[]): Promise<ApiMatch[]> {
    const { oddsBatchSize: size, oddsBatchPauseMs: pauseMs } = this;
    const out: ApiMatch[] = [];
    for (let i = 0; i < matches.length; i += size) {
      const chunk = matches.slice(i, i + size);
      const part = await Promise.all(chunk.map((m) => this.enrichWithOdds(m)));
      out.push(...part);
      if (i + size < matches.length && pauseMs > 0) {
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    }
    return out;
  }

  /** Odds no payload da listagem: array de mercados ou objeto { homeWin, draw, awayWin } (v4). */
  private hasOddsPayload(odds: ApiMatch['odds'] | undefined): boolean {
    if (!odds) return false;
    if (Array.isArray(odds)) return odds.length > 0;
    const o = odds as ApiMatchOddsCompact;
    return [o.homeWin, o.draw, o.awayWin].some(
      (v) => v != null && !Number.isNaN(Number(v)) && Number(v) > 0,
    );
  }

  /** Guarda médias compactas antes de substituir `odds` pelo payload detalhado. */
  private snapshotList1x2(match: ApiMatch): ApiMatchOddsCompact | undefined {
    if (match.oddsList1x2 != null) return match.oddsList1x2;
    const o = match.odds;
    if (!o || typeof o !== 'object' || Array.isArray(o)) return undefined;
    const c = o as ApiMatchOddsCompact;
    const h = Number(c.homeWin);
    const dr = Number(c.draw);
    const aw = Number(c.awayWin);
    const any = [
      Number.isFinite(h) && h > 1,
      Number.isFinite(dr) && dr > 1,
      Number.isFinite(aw) && aw > 1,
    ].some(Boolean);
    if (!any) return undefined;
    return {
      homeWin: Number.isFinite(h) ? h : undefined,
      draw: Number.isFinite(dr) ? dr : undefined,
      awayWin: Number.isFinite(aw) ? aw : undefined,
    };
  }

  private async enrichWithOdds(match: ApiMatch): Promise<ApiMatch> {
    const list1x2 = this.snapshotList1x2(match);

    try {
      const { data } = await axios.get<{ odds?: ApiMatch['odds'] }>(
        `${this.baseUrl}/matches/${match.id}/odds`,
        { headers: { 'X-Auth-Token': this.apiKey } },
      );
      const incoming = data.odds;
      if (incoming == null) return { ...match, oddsList1x2: list1x2 ?? match.oddsList1x2 };
      if (Array.isArray(incoming) && incoming.length === 0) {
        return { ...match, oddsList1x2: list1x2 ?? match.oddsList1x2 };
      }
      return { ...match, odds: incoming, oddsList1x2: list1x2 };
    } catch {
      return { ...match, oddsList1x2: list1x2 ?? match.oddsList1x2 };
    }
  }

  private getMockMatches(date: string): ApiMatch[] {
    const base = new Date(date + 'T15:00:00Z').getTime();
    const status = 'SCHEDULED';
    return [
      {
        id: 1,
        homeTeam: { name: 'Time A' },
        awayTeam: { name: 'Time B' },
        competition: { name: 'Liga Nacional' },
        utcDate: new Date(base).toISOString(),
        status,
        odds: [
          {
            market: 'HOME_WIN',
            outcomes: [
              { name: 'Home', odds: '1.65' },
              { name: 'Draw', odds: '3.80' },
              { name: 'Away', odds: '5.00' },
            ],
          },
        ],
      },
      {
        id: 2,
        homeTeam: { name: 'Time C' },
        awayTeam: { name: 'Time D' },
        competition: { name: 'Liga Sul' },
        utcDate: new Date(base + 7200000).toISOString(),
        status,
        odds: [
          {
            market: 'HOME_WIN',
            outcomes: [
              { name: 'Home', odds: '1.72' },
              { name: 'Draw', odds: '3.60' },
              { name: 'Away', odds: '4.50' },
            ],
          },
        ],
      },
      {
        id: 3,
        homeTeam: { name: 'Time E' },
        awayTeam: { name: 'Time F' },
        competition: { name: 'Copa' },
        utcDate: new Date(base + 14400000).toISOString(),
        status,
        odds: [
          {
            market: 'HOME_WIN',
            outcomes: [
              { name: 'Home', odds: '1.68' },
              { name: 'Draw', odds: '4.00' },
              { name: 'Away', odds: '5.50' },
            ],
          },
        ],
      },
      {
        id: 4,
        homeTeam: { name: 'Time G' },
        awayTeam: { name: 'Time H' },
        competition: { name: 'Série B' },
        utcDate: new Date(base + 21600000).toISOString(),
        status,
        odds: [
          {
            market: 'HOME_WIN',
            outcomes: [
              { name: 'Home', odds: '2.10' },
              { name: 'Draw', odds: '3.20' },
              { name: 'Away', odds: '3.40' },
            ],
          },
        ],
      },
      {
        id: 5,
        homeTeam: { name: 'Time I' },
        awayTeam: { name: 'Time J' },
        competition: { name: 'Estadual' },
        utcDate: new Date(base + 28800000).toISOString(),
        status,
        odds: [
          {
            market: 'HOME_WIN',
            outcomes: [
              { name: 'Home', odds: '1.85' },
              { name: 'Draw', odds: '3.50' },
              { name: 'Away', odds: '4.20' },
            ],
          },
        ],
      },
      {
        id: 6,
        homeTeam: { name: 'Time K' },
        awayTeam: { name: 'Time L' },
        competition: { name: 'Copa regional' },
        utcDate: new Date(base + 36000000).toISOString(),
        status,
        odds: [
          {
            market: 'HOME_WIN',
            outcomes: [
              { name: 'Home', odds: '2.25' },
              { name: 'Draw', odds: '3.10' },
              { name: 'Away', odds: '3.15' },
            ],
          },
        ],
      },
      {
        id: 7,
        homeTeam: { name: 'Time M' },
        awayTeam: { name: 'Time N' },
        competition: { name: 'Amistoso' },
        utcDate: new Date(base + 43200000).toISOString(),
        status,
        odds: [
          {
            market: 'HOME_WIN',
            outcomes: [
              { name: 'Home', odds: '1.62' },
              { name: 'Draw', odds: '3.90' },
              { name: 'Away', odds: '5.10' },
            ],
          },
        ],
      },
    ];
  }

  private parseOutcomePrice(o?: {
    odds?: unknown;
    odd?: unknown;
    price?: unknown;
  }): number | null {
    if (!o) return null;
    const raw = o.odds ?? o.odd ?? o.price;
    if (raw == null) return null;
    const x = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(x) || x < 1.01) return null;
    return x;
  }

  private normOddsLabel(name: unknown): string {
    return String(name ?? '')
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /**
   * Resolve 1×2 a partir de uma lista de outcomes de um mercado.
   * A API costuma enviar "Home / Draw / Away" ou os **nomes dos clubes** + empate.
   */
  /** Preferir médias `{ homeWin, draw, awayWin }` (listagem compacta ou snapshot). */
  private compactOddsTo1x2(
    c: ApiMatchOddsCompact | Record<string, unknown> | undefined,
  ): Record<string, number | null> | null {
    if (!c || typeof c !== 'object') return null;
    const n = (v: unknown): number | null => {
      if (v == null) return null;
      const x = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(x) || x < 1.01) return null;
      return x;
    };
    const o = c as Record<string, unknown>;
    const HOME_WIN = n(o.homeWin ?? o.home_win);
    const DRAW = n(o.draw);
    const AWAY_WIN = n(o.awayWin ?? o.away_win);
    if (HOME_WIN != null && DRAW != null && AWAY_WIN != null) {
      return { HOME_WIN, DRAW, AWAY_WIN };
    }
    return null;
  }

  private resolve1x2FromOutcomes(
    match: ApiMatch,
    outs: Array<{
      name?: string;
      odds?: unknown;
      odd?: unknown;
      price?: unknown;
    }>,
  ): Record<string, number | null> | null {
    if (outs.length < 3) return null;
    const homeTeam = this.normOddsLabel(match.homeTeam?.name ?? '');
    const awayTeam = this.normOddsLabel(match.awayTeam?.name ?? '');

    let h: number | null = null;
    let d: number | null = null;
    let a: number | null = null;

    for (const o of outs) {
      const price = this.parseOutcomePrice(o);
      if (price == null) continue;
      const lbl = this.normOddsLabel(o.name ?? '');
      if (/^(home|casa|1)$/.test(lbl) || lbl === '1') {
        h = h == null ? price : Math.max(h, price);
      } else if (/^(draw|empate|x)$/.test(lbl) || lbl === 'x') {
        d = d == null ? price : Math.max(d, price);
      } else if (/^(away|fora|2)$/.test(lbl) || lbl === '2') {
        a = a == null ? price : Math.max(a, price);
      }
    }

    if (h != null && d != null && a != null) {
      return { HOME_WIN: h, DRAW: d, AWAY_WIN: a };
    }

    const drawIx = outs.findIndex((o) =>
      /\b(draw|empate)\b/i.test(String(o.name ?? '')) ||
      /^x$/i.test(String(o.name ?? '').trim()),
    );
    if (drawIx >= 0) {
      const dPrice = this.parseOutcomePrice(outs[drawIx]);
      if (dPrice != null) d = dPrice;
      const rest = outs.filter((_, i) => i !== drawIx);
      if (rest.length === 2 && homeTeam.length && awayTeam.length) {
        const overlap = (label: string, team: string) => {
          if (!label || !team) return 0;
          if (label.includes(team.slice(0, 12)) || team.includes(label.slice(0, 12)))
            return 2;
          return 0;
        };
        const o0 = rest[0];
        const o1 = rest[1];
        const l0 = this.normOddsLabel(o0.name ?? '');
        const l1 = this.normOddsLabel(o1.name ?? '');
        const s0h = overlap(l0, homeTeam);
        const s0a = overlap(l0, awayTeam);
        const s1h = overlap(l1, homeTeam);
        const s1a = overlap(l1, awayTeam);
        const p0 = this.parseOutcomePrice(o0);
        const p1 = this.parseOutcomePrice(o1);
        if (p0 != null && p1 != null) {
          if (s0h + s1a > s0a + s1h) {
            h = p0;
            a = p1;
          } else if (s0a + s1h > s0h + s1a) {
            a = p0;
            h = p1;
          } else if (s0h > s0a && s1a > s1h) {
            h = p0;
            a = p1;
          } else if (s0a > s0h && s1h > s1a) {
            a = p0;
            h = p1;
          }
        }
      }
    }

    if (h != null && d != null && a != null) {
      return { HOME_WIN: h, DRAW: d, AWAY_WIN: a };
    }
    return null;
  }

  private extractOddsMap(match: ApiMatch): Record<string, number | null> {
    const empty = (): Record<string, number | null> => ({
      HOME_WIN: null,
      DRAW: null,
      AWAY_WIN: null,
    });
    const prefList = this.compactOddsTo1x2(match.oddsList1x2);
    if (prefList) return prefList;

    const raw = match.odds as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const prefEmbed = this.compactOddsTo1x2(raw as Record<string, unknown>);
      if (prefEmbed) return prefEmbed;
    }

    const arr = Array.isArray(raw) ? raw : [];
    for (const bk of arr) {
      if (!bk || typeof bk !== 'object') continue;
      const row = bk as {
        outcomes?: Array<{
          name?: string;
          odds?: unknown;
          odd?: unknown;
          price?: unknown;
        }>;
        values?: Array<{
          name?: string;
          odds?: unknown;
          odd?: unknown;
          price?: unknown;
        }>;
      };
      const outs =
        Array.isArray(row.outcomes)
          ? row.outcomes
          : Array.isArray(row.values)
            ? row.values
            : null;
      if (!outs || outs.length < 3) continue;
      const resolved = this.resolve1x2FromOutcomes(match, outs);
      if (
        resolved &&
        resolved.HOME_WIN != null &&
        resolved.DRAW != null &&
        resolved.AWAY_WIN != null
      ) {
        return resolved;
      }
    }

    const flat = arr.flatMap((x) => {
      if (
        x &&
        typeof x === 'object' &&
        Array.isArray((x as { outcomes?: unknown[] }).outcomes)
      ) {
        return (x as { outcomes: Array<{ name?: string; odds?: unknown; odd?: unknown; price?: unknown }> }).outcomes;
      }
      return [];
    });
    if (flat.length >= 3) {
      const r = this.resolve1x2FromOutcomes(match, flat);
      if (
        r &&
        r.HOME_WIN != null &&
        r.DRAW != null &&
        r.AWAY_WIN != null
      ) {
        return r;
      }
    }

    return empty();
  }
}
