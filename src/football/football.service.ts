import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PredictionsService } from '../predictions/predictions.service';
import { Prediction, PlanType } from '../predictions/prediction.entity';

interface ApiMatch {
  id: number;
  homeTeam: { name: string };
  awayTeam: { name: string };
  competition: { name: string };
  utcDate: string;
  odds?: Array<{
    market: string;
    outcomes: Array<{ name: string; odds: string }>;
  }>;
}

type PredictionMarket = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN';

interface AiPredictionItem {
  matchId: number;
  market: PredictionMarket;
  confidence: number; // 0..100
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
  private readonly openAiKey: string;
  private readonly openAiModel: string;
  private readonly baseUrl = 'https://api.football-data.org/v4';

  constructor(
    private readonly config: ConfigService,
    private readonly predictionsService: PredictionsService,
  ) {
    this.apiKey = this.config.get<string>('FOOTBALL_API_KEY') || '';
    this.openAiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.openAiModel = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
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
      const from = `${targetDate}T00:00:00Z`;
      const to = `${targetDate}T23:59:59Z`;
      const comps = this.topLeagueIds.join(',');
      const { data } = await axios.get<{ matches?: ApiMatchResult[] }>(
        `${this.baseUrl}/matches`,
        {
          params: { dateFrom: from, dateTo: to, competitions: comps },
          headers: { 'X-Auth-Token': this.apiKey },
        },
      );
      const list = (data.matches || []).map((m) => this.toMatchResultDto(m));
      return list.sort(
        (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      );
    } catch {
      return this.getMockResults(targetDate);
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

  private async fetchMatchesByStatus(
    date: string,
    status: string,
  ): Promise<ApiMatchResult[]> {
    if (!this.apiKey) return [];
    try {
      const from = `${date}T00:00:00Z`;
      const to = `${date}T23:59:59Z`;
      const { data } = await axios.get<{ matches?: ApiMatchResult[] }>(
        `${this.baseUrl}/matches`,
        {
          params: { dateFrom: from, dateTo: to, status },
          headers: { 'X-Auth-Token': this.apiKey },
        },
      );
      const matches = data.matches || [];
      return matches.sort(
        (a, b) =>
          new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
      );
    } catch {
      return this.getMockResults(date) as unknown as ApiMatchResult[];
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

  /** Gera prognósticos do dia a partir da API (ou mock se sem chave) */
  async generateDailyPredictions(date?: string): Promise<{ count: number }> {
    const targetDate = date || this.predictionsService.today();
    const raw = await this.fetchMatchesWithOdds(targetDate);
    const predictions = this.openAiKey
      ? await this.buildPredictionsWithAi(raw, targetDate)
      : this.buildPredictionsFromMatches(raw, targetDate);
    await this.predictionsService.clearByDate(targetDate);
    const saved = await this.predictionsService.saveMany(predictions);
    return { count: saved.length };
  }

  private async fetchMatchesWithOdds(
    date: string,
  ): Promise<ApiMatch[]> {
    if (!this.apiKey) {
      return this.getMockMatches(date);
    }
    try {
      const from = `${date}T00:00:00Z`;
      const to = `${date}T23:59:59Z`;
      const { data } = await axios.get<{ matches?: ApiMatch[] }>(
        `${this.baseUrl}/matches`,
        {
          params: { dateFrom: from, dateTo: to },
          headers: { 'X-Auth-Token': this.apiKey },
        },
      );
      const matches = data.matches || [];
      const withOdds = await Promise.all(
        matches.slice(0, 50).map((m) => this.enrichWithOdds(m)),
      );
      return withOdds.filter((m) => m.odds && m.odds.length > 0);
    } catch {
      return this.getMockMatches(date);
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
    return [
      {
        id: 1,
        homeTeam: { name: 'Time A' },
        awayTeam: { name: 'Time B' },
        competition: { name: 'Liga Nacional' },
        utcDate: new Date(base).toISOString(),
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
        odds: [
          {
            market: 'HOME_WIN',
            outcomes: [
              { name: 'Home', odds: '1.55' },
              { name: 'Draw', odds: '4.00' },
              { name: 'Away', odds: '5.50' },
            ],
          },
        ],
      },
    ];
  }

  private buildPredictionsFromMatches(
    matches: ApiMatch[],
    predictionDate: string,
  ): Partial<Prediction>[] {
    const list: Partial<Prediction>[] = [];
    for (const m of matches) {
      const homeWin = m.odds
        ?.flatMap((o) => o.outcomes)
        .find((x) => x.name === 'Home');
      if (!homeWin) continue;
      const odd = parseFloat(homeWin.odds);
      const probability = this.oddToProbability(odd);
      const minPlan = this.probabilityToPlan(probability);
      list.push({
        matchId: String(m.id),
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.competition.name,
        startTime: new Date(m.utcDate),
        market: 'HOME_WIN',
        probability,
        odd,
        minPlan,
        predictionDate,
      });
    }
    return list.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
  }

  private async buildPredictionsWithAi(
    matches: ApiMatch[],
    predictionDate: string,
  ): Promise<Partial<Prediction>[]> {
    if (!matches.length || !this.openAiKey) {
      return this.buildPredictionsFromMatches(matches, predictionDate);
    }

    try {
      const inputMatches = matches.slice(0, 30).map((m) => ({
        matchId: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        league: m.competition.name,
        startTime: m.utcDate,
        odds: this.extractOddsMap(m),
      }));

      const prompt = [
        'Você é um analista de apostas esportivas.',
        'Para cada jogo, escolha EXATAMENTE um mercado entre HOME_WIN, DRAW, AWAY_WIN.',
        'Retorne APENAS JSON válido, sem markdown e sem texto extra.',
        'Formato obrigatório:',
        '{"predictions":[{"matchId":123,"market":"HOME_WIN","confidence":68}]}',
        'confidence é percentual inteiro de 51 a 95.',
        'Nunca retorne matchId duplicado.',
        `Jogos: ${JSON.stringify(inputMatches)}`,
      ].join('\n');

      const { data } = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.openAiModel,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        },
        {
          timeout: 25000,
          headers: {
            Authorization: `Bearer ${this.openAiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const content = data?.choices?.[0]?.message?.content;
      const parsed = this.parseAiPayload(content);
      const byId = new Map(matches.map((m) => [m.id, m]));
      const list: Partial<Prediction>[] = [];

      for (const row of parsed) {
        const match = byId.get(row.matchId);
        if (!match) continue;
        const odd = this.pickOddByMarket(match, row.market);
        if (!odd) continue;
        const probability = Math.min(0.95, Math.max(0.51, row.confidence / 100));
        list.push({
          matchId: String(match.id),
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          league: match.competition.name,
          startTime: new Date(match.utcDate),
          market: row.market,
          probability,
          odd,
          minPlan: this.probabilityToPlan(probability),
          predictionDate,
        });
      }

      if (list.length) {
        return list.sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0));
      }
    } catch (err) {
      this.logger.warn(
        `Falha ao gerar com IA (${this.openAiModel}), usando fallback por odds.`,
      );
    }

    return this.buildPredictionsFromMatches(matches, predictionDate);
  }

  private parseAiPayload(content: string): AiPredictionItem[] {
    if (!content) return [];
    try {
      const json = JSON.parse(content) as { predictions?: AiPredictionItem[] };
      return (json.predictions || []).filter((p) =>
        ['HOME_WIN', 'DRAW', 'AWAY_WIN'].includes(p.market),
      );
    } catch {
      return [];
    }
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

  private pickOddByMarket(match: ApiMatch, market: PredictionMarket): number | null {
    const odds = this.extractOddsMap(match);
    const value = odds[market];
    if (!value || Number.isNaN(value) || value <= 1) return null;
    return value;
  }

  private oddToProbability(odd: number): number {
    const implied = 1 / odd;
    const margin = 1.05;
    return Math.min(0.99, implied * margin);
  }

  private probabilityToPlan(probability: number): PlanType {
    if (probability >= 0.65) return PlanType.FREE;
    if (probability >= 0.58) return PlanType.DAILY;
    if (probability >= 0.52) return PlanType.WEEKLY;
    return PlanType.PREMIUM;
  }
}
