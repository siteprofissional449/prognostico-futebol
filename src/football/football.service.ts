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

@Injectable()
export class FootballService {
  private readonly logger = new Logger(FootballService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.football-data.org/v4';

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
    const ttlH = Number(this.config.get<string>('FOOTBALL_SCHEDULE_CACHE_TTL_HOURS'));
    this.scheduleTtlMs =
      Number.isFinite(ttlH) && ttlH > 0
        ? ttlH * 60 * 60 * 1000
        : 6 * 60 * 60 * 1000;
  }

  /** IDs das principais ligas do mundo (football-data.org) */
  private readonly topLeagueIds = [
    2021, // Premier League
    2014, // La Liga
    2019, // Serie A
    2002, // Bundesliga
    2015, // Ligue 1
    2001, // Champions League
    2018, // Europa League
  ];

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
      const comps = this.topLeagueIds.join(',');
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
    const comps = this.topLeagueIds.join(',');
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
      const outs =
        (book as { outcomes?: Array<{ name: string; odds: string }> }).outcomes ||
        [];
      for (const o of outs) {
        const label = (o.name || '').replace(/\s+/g, ' ').trim();
        const price = parseFloat(String(o.odds).replace(',', '.'));
        if (!Number.isFinite(price) || price < 1.01) continue;
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
      const comps = this.topLeagueIds.join(',');
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
      const withOdds = await Promise.all(
        matches.slice(0, 120).map((m) => this.enrichWithOdds(m)),
      );
      const withLoadedOdds = withOdds.filter((m) => this.hasOddsPayload(m.odds));
      if (withLoadedOdds.length === 0 && matches.length > 0) {
        this.logger.warn(
          `Football-Data: ${matches.length} partida(s) em ${date}, mas odds não carregaram (muito comum no plano free: endpoint /matches/{id}/odds). ` +
            `A geração ainda pode prosseguir com IA se OPENAI_API_KEY estiver configurada.`,
        );
        return withOdds;
      }
      return withLoadedOdds;
    } catch (e) {
      this.logger.warn(
        `Football-Data (matches+odds) falhou para ${date}: ${
          e instanceof Error ? e.message : e
        }`,
      );
      return [];
    }
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

  private async enrichWithOdds(match: ApiMatch): Promise<ApiMatch> {
    try {
      const { data } = await axios.get<{ odds?: ApiMatch['odds'] }>(
        `${this.baseUrl}/matches/${match.id}/odds`,
        { headers: { 'X-Auth-Token': this.apiKey } },
      );
      const incoming = data.odds;
      if (incoming == null) return match;
      if (Array.isArray(incoming) && incoming.length === 0) return match;
      return { ...match, odds: incoming };
    } catch {
      return match;
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

  private extractOddsMap(match: ApiMatch): Record<string, number | null> {
    const raw = match.odds as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = raw as Record<string, unknown>;
      const n = (v: unknown): number | null => {
        const x = typeof v === 'number' ? v : Number(v);
        return x != null && !Number.isNaN(x) && x > 0 ? x : null;
      };
      return {
        HOME_WIN: n(o.homeWin ?? o.home_win),
        DRAW: n(o.draw),
        AWAY_WIN: n(o.awayWin ?? o.away_win),
      };
    }
    const arr = Array.isArray(raw) ? raw : [];
    const outcomes = arr.flatMap((x) =>
      x && Array.isArray(x.outcomes) ? x.outcomes : [],
    );
    const home = outcomes.find((x) => x.name === 'Home');
    const draw = outcomes.find((x) => x.name === 'Draw');
    const away = outcomes.find((x) => x.name === 'Away');
    return {
      HOME_WIN: home ? parseFloat(home.odds) : null,
      DRAW: draw ? parseFloat(draw.odds) : null,
      AWAY_WIN: away ? parseFloat(away.odds) : null,
    };
  }
}
