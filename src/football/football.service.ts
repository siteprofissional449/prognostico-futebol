import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { PredictionsService } from '../predictions/predictions.service';
import { GenerationMeta } from './generation-meta.entity';

/** Partida com odds (football-data.org v4) — usada também na geração de prognósticos */
export interface ApiMatch {
  id: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  competition: { name: string };
  utcDate: string;
  status?: string;
  odds?: Array<{
    market: string;
    outcomes: Array<{ name: string; odds: string }>;
  }>;
}

/** Partida com placar (resultado) - estrutura football-data.org v4 */
export interface ApiMatchResult {
  id: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  competition: { name: string; code?: string };
  utcDate: string;
  status: string;
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

@Injectable()
export class FootballService {
  private readonly logger = new Logger(FootballService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.football-data.org/v4';

  constructor(
    private readonly config: ConfigService,
    @Inject(forwardRef(() => PredictionsService))
    private readonly predictionsService: PredictionsService,
    @InjectRepository(GenerationMeta)
    private readonly generationMetaRepo: Repository<GenerationMeta>,
  ) {
    this.apiKey = this.config.get<string>('FOOTBALL_API_KEY') || '';
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

  /** Melhores jogos do mundo: partidas das principais ligas no dia (agendadas ou finalizadas) */
  async getTopLeaguesMatches(date?: string): Promise<MatchResultDto[]> {
    const targetDate = date || this.predictionsService.today();
    if (!this.apiKey) {
      return this.getMockResults(targetDate);
    }
    try {
      const comps = this.topLeagueIds.join(',');
      /** v4: `date` é yyyy-MM-dd; dateFrom/dateTo com o mesmo dia podem devolver lista vazia (dateTo exclusivo). */
      const { data } = await axios.get<{ matches?: ApiMatchResult[] }>(
        `${this.baseUrl}/matches`,
        {
          params: { date: targetDate, competitions: comps },
          headers: { 'X-Auth-Token': this.apiKey },
        },
      );
      const list = (data.matches || []).map((m) => this.toMatchResultDto(m));
      return list.sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      );
    } catch (e) {
      this.logger.warn(
        `Football-Data (highlights) falhou para ${targetDate}: ${
          e instanceof Error ? e.message : e
        }`,
      );
      return [];
    }
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
    scheduleDescription: string;
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
    return {
      lastAt: row?.lastPredictionsAt?.toISOString() ?? null,
      lastCount: row?.lastCount ?? null,
      scheduleDescription: `Todos os dias às 00:05 (${tzLabel})`,
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
      const withLoadedOdds = withOdds.filter((m) => m.odds && m.odds.length > 0);
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

  private async enrichWithOdds(match: ApiMatch): Promise<ApiMatch> {
    try {
      const { data } = await axios.get<{ odds?: ApiMatch['odds'] }>(
        `${this.baseUrl}/matches/${match.id}/odds`,
        { headers: { 'X-Auth-Token': this.apiKey } },
      );
      return { ...match, odds: data.odds || [] };
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
    const outcomes = match.odds?.flatMap((o) => o.outcomes) || [];
    const home = outcomes.find((o) => o.name === 'Home');
    const draw = outcomes.find((o) => o.name === 'Draw');
    const away = outcomes.find((o) => o.name === 'Away');
    return {
      HOME_WIN: home ? parseFloat(home.odds) : null,
      DRAW: draw ? parseFloat(draw.odds) : null,
      AWAY_WIN: away ? parseFloat(away.odds) : null,
    };
  }
}
