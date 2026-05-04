import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

/** Resposta pública: contexto estatístico para análise pré-jogo. */
export interface LineupPlayerDto {
  name: string;
  position: string | null;
  shirtNumber: number | null;
}

export interface TeamTableRowDto {
  position: number | null;
  playedGames: number | null;
  points: number | null;
  won: number | null;
  draw: number | null;
  lost: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  /** Média de golos marcados por jogo (tabela total). */
  avgGoalsFor: number | null;
  /** Média de golos sofridos por jogo (tabela total). */
  avgGoalsAgainst: number | null;
}

export interface FormMatchDto {
  utcDate: string;
  opponent: string;
  isHome: boolean;
  teamScore: number;
  opponentScore: number;
  result: 'W' | 'D' | 'L';
  competition: string;
}

export interface H2HMatchDto {
  utcDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface TeamPreMatchSideDto {
  teamId: number | null;
  name: string;
  /** Classificação geral (TOTAL). */
  table: TeamTableRowDto | null;
  /** Desempenho em casa na liga (sub-tabela HOME). */
  homeSplit: TeamTableRowDto | null;
  /** Desempenho fora na liga (sub-tabela AWAY). */
  awaySplit: TeamTableRowDto | null;
  /** Últimos jogos finalizados (forma recente). */
  formLast5: FormMatchDto[];
  /** Titulares quando a API já os publicou (ex.: após escalação oficial); antes do jogo costuma vir vazio. */
  lineup: LineupPlayerDto[] | null;
}

export interface HeadToHeadBlockDto {
  matches: H2HMatchDto[];
  homeWins: number;
  draws: number;
  awayWins: number;
}

/** Lesões/suspensões: a football-data.org v4 não expõe este dado de forma fiável. */
export interface AbsencePlaceholderDto {
  side: 'HOME' | 'AWAY';
  note: string;
}

export interface MatchPreMatchAnalysisDto {
  matchId: number;
  status: string | null;
  competition: string;
  competitionCode: string | null;
  home: TeamPreMatchSideDto;
  away: TeamPreMatchSideDto;
  headToHead: HeadToHeadBlockDto;
  absences: AbsencePlaceholderDto[];
  /** Texto curto para o utilizador (ex.: limitações da fonte). */
  dataSourceNote: string;
}

type ApiTeamRef = { id?: number; name?: string };
type ApiScoreFt = { home?: number; away?: number; homeTeam?: number; awayTeam?: number };

@Injectable()
export class MatchPreMatchAnalysisService {
  private readonly logger = new Logger(MatchPreMatchAnalysisService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.football-data.org/v4';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('FOOTBALL_API_KEY') || '';
  }

  async getPreMatchAnalysis(matchId: number): Promise<MatchPreMatchAnalysisDto | null> {
    if (!Number.isFinite(matchId) || matchId <= 0) return null;
    if (!this.apiKey) {
      return this.buildMockAnalysis(matchId);
    }
    const headers = { 'X-Auth-Token': this.apiKey };
    let root: Record<string, unknown>;
    try {
      const { data } = await axios.get<Record<string, unknown>>(
        `${this.baseUrl}/matches/${matchId}`,
        { headers, timeout: 20000 },
      );
      root = data;
    } catch (e) {
      this.logger.warn(
        `Pré-análise: GET match ${matchId} falhou: ${
          e instanceof Error ? e.message : e
        }`,
      );
      return null;
    }

    const competition = (root.competition as Record<string, unknown> | undefined) ?? {};
    const compId = num(competition.id);
    const compName = str(competition.name) ?? '—';
    const compCode = str(competition.code);
    const status = str(root.status);

    const homeTeam = (root.homeTeam as Record<string, unknown> | undefined) ?? {};
    const awayTeam = (root.awayTeam as Record<string, unknown> | undefined) ?? {};
    const homeId = num(homeTeam.id);
    const awayId = num(awayTeam.id);
    const homeName = str(homeTeam.name) ?? 'Mandante';
    const awayName = str(awayTeam.name) ?? 'Visitante';

    const standingsP =
      compId != null ?
        axios
          .get(`${this.baseUrl}/competitions/${compId}/standings`, {
            headers,
            timeout: 20000,
          })
          .then((r) => r.data as Record<string, unknown>)
          .catch(() => null)
      : Promise.resolve(null);

    const h2hP = axios
      .get(`${this.baseUrl}/matches/${matchId}/head2head`, {
        params: { limit: 10 },
        headers,
        timeout: 20000,
      })
      .then((r) => r.data as Record<string, unknown>)
      .catch(() => null);

    const homeMatchesP =
      homeId != null ?
        axios
          .get(`${this.baseUrl}/teams/${homeId}/matches`, {
            params: { status: 'FINISHED', limit: 20 },
            headers,
            timeout: 20000,
          })
          .then((r) => r.data as Record<string, unknown>)
          .catch(() => null)
      : Promise.resolve(null);

    const awayMatchesP =
      awayId != null ?
        axios
          .get(`${this.baseUrl}/teams/${awayId}/matches`, {
            params: { status: 'FINISHED', limit: 20 },
            headers,
            timeout: 20000,
          })
          .then((r) => r.data as Record<string, unknown>)
          .catch(() => null)
      : Promise.resolve(null);

    const [standingsRaw, h2hRaw, homeMatchesRaw, awayMatchesRaw] = await Promise.all([
      standingsP,
      h2hP,
      homeMatchesP,
      awayMatchesP,
    ]);

    const homeTable =
      homeId != null && standingsRaw ?
        this.pickStandingForTeam(standingsRaw, 'TOTAL', homeId)
      : null;
    const awayTable =
      awayId != null && standingsRaw ?
        this.pickStandingForTeam(standingsRaw, 'TOTAL', awayId)
      : null;
    const homeHomeSplit =
      homeId != null && standingsRaw ?
        this.pickStandingForTeam(standingsRaw, 'HOME', homeId)
      : null;
    const homeAwaySplit =
      homeId != null && standingsRaw ?
        this.pickStandingForTeam(standingsRaw, 'AWAY', homeId)
      : null;
    const awayHomeSplit =
      awayId != null && standingsRaw ?
        this.pickStandingForTeam(standingsRaw, 'HOME', awayId)
      : null;
    const awayAwaySplit =
      awayId != null && standingsRaw ?
        this.pickStandingForTeam(standingsRaw, 'AWAY', awayId)
      : null;

    const h2hBlock = this.parseHeadToHead(h2hRaw, homeName, awayName, homeId, awayId);

    const formHome =
      homeId != null ? this.buildForm(homeMatchesRaw, homeId, homeName) : [];
    const formAway =
      awayId != null ? this.buildForm(awayMatchesRaw, awayId, awayName) : [];

    const homeLineup = this.parseLineup(homeTeam.lineup);
    const awayLineup = this.parseLineup(awayTeam.lineup);

    return {
      matchId,
      status,
      competition: compName,
      competitionCode: compCode,
      home: {
        teamId: homeId,
        name: homeName,
        table: homeTable,
        homeSplit: homeHomeSplit,
        awaySplit: homeAwaySplit,
        formLast5: formHome,
        lineup: homeLineup,
      },
      away: {
        teamId: awayId,
        name: awayName,
        table: awayTable,
        homeSplit: awayHomeSplit,
        awaySplit: awayAwaySplit,
        formLast5: formAway,
        lineup: awayLineup,
      },
      headToHead: h2hBlock,
      absences: [
        {
          side: 'HOME',
          note:
            'Lesões e suspensões não estão disponíveis via football-data.org neste integração.',
        },
        {
          side: 'AWAY',
          note:
            'Para desfalques atualizados, consulta comunicados oficiais dos clubes ou imprensa desportiva.',
        },
      ],
      dataSourceNote:
        'Dados de classificação, H2H, forma e médias vêm da API football-data.org (temporada atual). ' +
        'Escalações só aparecem quando a fonte as publica (muitas vezes perto do apito inicial).',
    };
  }

  private buildMockAnalysis(matchId: number): MatchPreMatchAnalysisDto {
    const mkForm = (seed: string): FormMatchDto[] => {
      const results: Array<'W' | 'D' | 'L'> = ['W', 'W', 'D', 'L', 'W'];
      return results.map((r, i) => ({
        utcDate: new Date(Date.UTC(2026, 0, 10 + i, 15, 0)).toISOString(),
        opponent: `${seed} rival ${i + 1}`,
        isHome: i % 2 === 0,
        teamScore: r === 'W' ? 2 : r === 'D' ? 1 : 0,
        opponentScore: r === 'W' ? 0 : r === 'D' ? 1 : 2,
        result: r,
        competition: 'Liga (demo)',
      }));
    };
    return {
      matchId,
      status: 'SCHEDULED',
      competition: 'Demonstração (sem API key)',
      competitionCode: null,
      home: {
        teamId: null,
        name: 'Equipa da casa',
        table: {
          position: 3,
          playedGames: 20,
          points: 38,
          won: 11,
          draw: 5,
          lost: 4,
          goalsFor: 32,
          goalsAgainst: 18,
          avgGoalsFor: 1.6,
          avgGoalsAgainst: 0.9,
        },
        homeSplit: {
          position: 2,
          playedGames: 10,
          points: 22,
          won: 7,
          draw: 1,
          lost: 2,
          goalsFor: 19,
          goalsAgainst: 9,
          avgGoalsFor: 1.9,
          avgGoalsAgainst: 0.9,
        },
        awaySplit: {
          position: 6,
          playedGames: 10,
          points: 16,
          won: 4,
          draw: 4,
          lost: 2,
          goalsFor: 13,
          goalsAgainst: 9,
          avgGoalsFor: 1.3,
          avgGoalsAgainst: 0.9,
        },
        formLast5: mkForm('Casa'),
        lineup: null,
      },
      away: {
        teamId: null,
        name: 'Visitante',
        table: {
          position: 7,
          playedGames: 20,
          points: 28,
          won: 8,
          draw: 4,
          lost: 8,
          goalsFor: 24,
          goalsAgainst: 26,
          avgGoalsFor: 1.2,
          avgGoalsAgainst: 1.3,
        },
        homeSplit: {
          position: 5,
          playedGames: 10,
          points: 18,
          won: 5,
          draw: 3,
          lost: 2,
          goalsFor: 14,
          goalsAgainst: 11,
          avgGoalsFor: 1.4,
          avgGoalsAgainst: 1.1,
        },
        awaySplit: {
          position: 10,
          playedGames: 10,
          points: 10,
          won: 3,
          draw: 1,
          lost: 6,
          goalsFor: 10,
          goalsAgainst: 15,
          avgGoalsFor: 1.0,
          avgGoalsAgainst: 1.5,
        },
        formLast5: mkForm('Fora'),
        lineup: null,
      },
      headToHead: {
        matches: [
          {
            utcDate: new Date(Date.UTC(2025, 10, 2, 20, 0)).toISOString(),
            homeTeam: 'Equipa da casa',
            awayTeam: 'Visitante',
            homeScore: 2,
            awayScore: 1,
          },
          {
            utcDate: new Date(Date.UTC(2025, 4, 15, 17, 30)).toISOString(),
            homeTeam: 'Visitante',
            awayTeam: 'Equipa da casa',
            homeScore: 0,
            awayScore: 0,
          },
        ],
        homeWins: 1,
        draws: 1,
        awayWins: 0,
      },
      absences: [
        {
          side: 'HOME',
          note: 'Modo demo: configura FOOTBALL_API_KEY para dados reais.',
        },
        {
          side: 'AWAY',
          note: 'Desfalques reais não vêm desta API.',
        },
      ],
      dataSourceNote:
        'Resposta de demonstração sem chave FOOTBALL_API_KEY. Com chave válida, os blocos são preenchidos a partir da football-data.org.',
    };
  }

  private pickStandingForTeam(
    standingsRoot: Record<string, unknown>,
    type: 'TOTAL' | 'HOME' | 'AWAY',
    teamId: number,
  ): TeamTableRowDto | null {
    const standings = standingsRoot.standings;
    if (!Array.isArray(standings)) return null;
    const block = standings.find(
      (s) => s && typeof s === 'object' && String((s as { type?: string }).type) === type,
    ) as { table?: unknown[] } | undefined;
    const table = block?.table;
    if (!Array.isArray(table)) return null;
    const row = table.find(
      (r) =>
        r &&
        typeof r === 'object' &&
        num((r as { team?: { id?: number } }).team?.id) === teamId,
    ) as Record<string, unknown> | undefined;
    if (!row) return null;
    const played = num(row.playedGames);
    const gf = num(row.goalsFor);
    const ga = num(row.goalsAgainst);
    return {
      position: num(row.position),
      playedGames: played,
      points: num(row.points),
      won: num(row.won),
      draw: num(row.draw),
      lost: num(row.lost),
      goalsFor: gf,
      goalsAgainst: ga,
      avgGoalsFor:
        played != null && played > 0 && gf != null ? round2(gf / played) : null,
      avgGoalsAgainst:
        played != null && played > 0 && ga != null ? round2(ga / played) : null,
    };
  }

  private parseHeadToHead(
    raw: Record<string, unknown> | null,
    homeName: string,
    awayName: string,
    homeId: number | null,
    awayId: number | null,
  ): HeadToHeadBlockDto {
    const matchesRaw = raw?.matches;
    if (!Array.isArray(matchesRaw) || matchesRaw.length === 0) {
      return { matches: [], homeWins: 0, draws: 0, awayWins: 0 };
    }
    const sorted = [...matchesRaw]
      .filter((m) => m && typeof m === 'object')
      .sort(
        (a, b) =>
          new Date(str((b as { utcDate?: string }).utcDate) ?? 0).getTime() -
          new Date(str((a as { utcDate?: string }).utcDate) ?? 0).getTime(),
      )
      .slice(0, 10);

    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;

    const out: H2HMatchDto[] = [];
    for (const m of sorted) {
      const row = m as Record<string, unknown>;
      const ht = (row.homeTeam as ApiTeamRef | undefined)?.name ?? '—';
      const at = (row.awayTeam as ApiTeamRef | undefined)?.name ?? '—';
      const hid = num((row.homeTeam as ApiTeamRef | undefined)?.id);
      const aid = num((row.awayTeam as ApiTeamRef | undefined)?.id);
      const sc = (row.score as { fullTime?: ApiScoreFt } | undefined)?.fullTime;
      const { h, a } = parseFullTime(sc);
      out.push({
        utcDate: str(row.utcDate) ?? '',
        homeTeam: ht,
        awayTeam: at,
        homeScore: h,
        awayScore: a,
      });

      const side = h2hResultForCurrentFixture(
        homeId,
        awayId,
        homeName,
        awayName,
        hid,
        aid,
        ht,
        at,
        h,
        a,
      );
      if (side === 'CURRENT_HOME') homeWins += 1;
      else if (side === 'CURRENT_AWAY') awayWins += 1;
      else if (side === 'DRAW') draws += 1;
    }

    return { matches: out, homeWins, draws, awayWins };
  }

  private buildForm(
    raw: Record<string, unknown> | null,
    teamId: number,
    teamName: string,
  ): FormMatchDto[] {
    const list = raw?.matches;
    if (!Array.isArray(list)) return [];
    const finished = list
      .filter((m) => m && typeof m === 'object')
      .filter((m) => String((m as { status?: string }).status) === 'FINISHED')
      .sort(
        (a, b) =>
          new Date(str((b as { utcDate?: string }).utcDate) ?? 0).getTime() -
          new Date(str((a as { utcDate?: string }).utcDate) ?? 0).getTime(),
      )
      .slice(0, 5);

    const out: FormMatchDto[] = [];
    for (const m of finished) {
      const row = m as Record<string, unknown>;
      const hid = num((row.homeTeam as ApiTeamRef | undefined)?.id);
      const aid = num((row.awayTeam as ApiTeamRef | undefined)?.id);
      const ht = str((row.homeTeam as ApiTeamRef | undefined)?.name) ?? '—';
      const at = str((row.awayTeam as ApiTeamRef | undefined)?.name) ?? '—';
      const comp = str(
        ((row.competition as { name?: string } | undefined) ?? {}).name,
      );
      const sc = (row.score as { fullTime?: ApiScoreFt } | undefined)?.fullTime;
      const { h, a } = parseFullTime(sc);
      const isHome = hid === teamId;
      const opp = isHome ? at : ht;
      const teamScore = isHome ? h : a;
      const oppScore = isHome ? a : h;
      let result: 'W' | 'D' | 'L' = 'D';
      if (teamScore > oppScore) result = 'W';
      else if (teamScore < oppScore) result = 'L';
      out.push({
        utcDate: str(row.utcDate) ?? '',
        opponent: opp,
        isHome,
        teamScore,
        opponentScore: oppScore,
        result,
        competition: comp ?? '—',
      });
    }
    if (!out.length && teamName) {
      this.logger.debug(`Forma vazia para equipa ${teamName} (${teamId}).`);
    }
    return out;
  }

  private parseLineup(raw: unknown): LineupPlayerDto[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const out: LineupPlayerDto[] = [];
    for (const p of raw) {
      if (!p || typeof p !== 'object') continue;
      const o = p as Record<string, unknown>;
      const name = str(o.name);
      if (!name) continue;
      out.push({
        name,
        position: str(o.position),
        shirtNumber:
          o.shirtNumber != null && Number.isFinite(Number(o.shirtNumber)) ?
            Math.round(Number(o.shirtNumber))
          : null,
      });
    }
    return out.length ? out : null;
  }
}

function str(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  return v.trim();
}

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseFullTime(ft: ApiScoreFt | undefined): { h: number; a: number } {
  if (!ft) return { h: 0, a: 0 };
  const h =
    ft.home != null && Number.isFinite(Number(ft.home)) ?
      Number(ft.home)
    : ft.homeTeam != null && Number.isFinite(Number(ft.homeTeam)) ?
      Number(ft.homeTeam)
    : 0;
  const a =
    ft.away != null && Number.isFinite(Number(ft.away)) ?
      Number(ft.away)
    : ft.awayTeam != null && Number.isFinite(Number(ft.awayTeam)) ?
      Number(ft.awayTeam)
    : 0;
  return { h, a };
}

function normTeam(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Vencedor do confronto histórico visto do jogo atual (mandante atual vs visitante atual).
 */
function h2hResultForCurrentFixture(
  curHomeId: number | null,
  curAwayId: number | null,
  curHomeName: string,
  curAwayName: string,
  histHomeId: number | null,
  histAwayId: number | null,
  histHomeName: string,
  histAwayName: string,
  histHomeScore: number,
  histAwayScore: number,
): 'CURRENT_HOME' | 'CURRENT_AWAY' | 'DRAW' | null {
  const goalsForTeam = (
    teamId: number | null,
    teamName: string,
  ): number | null => {
    if (teamId != null && histHomeId != null && histAwayId != null) {
      if (histHomeId === teamId) return histHomeScore;
      if (histAwayId === teamId) return histAwayScore;
    }
    const nh = normTeam(histHomeName);
    const na = normTeam(histAwayName);
    const tn = normTeam(teamName);
    if (nh === tn) return histHomeScore;
    if (na === tn) return histAwayScore;
    return null;
  };

  const gHome = goalsForTeam(curHomeId, curHomeName);
  const gAway = goalsForTeam(curAwayId, curAwayName);
  if (gHome == null || gAway == null) return null;
  if (gHome > gAway) return 'CURRENT_HOME';
  if (gAway > gHome) return 'CURRENT_AWAY';
  return 'DRAW';
}
