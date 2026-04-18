import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { FootballService, ApiMatch } from '../football/football.service';
import { GenerationMeta } from '../football/generation-meta.entity';
import { PredictionsService } from './predictions.service';
import { Prediction, PlanType } from './prediction.entity';

export type PredictionMarket = 'HOME_WIN' | 'DRAW' | 'AWAY_WIN';

/** Odd mínima para gravar palpite (evita mercados ridiculamente baixos). */
const MIN_ODD_THRESHOLD = 1.05;
const FREE_TIER_MAX_GAMES = 5;

interface AiJsonPayload {
  match?: string;
  prob_home_win?: number;
  prob_draw?: number;
  prob_away_win?: number;
  best_bet?: string;
  analysis?: string;
}

interface PredictionCore {
  probHome: number;
  probDraw: number;
  probAway: number;
  market: PredictionMarket;
  analysis: string;
}

export type GenerateDailyPredictionsResult = {
  count: number;
  date: string;
  candidates: number;
  skippedDuplicate: number;
  skippedNoOdds: number;
  skippedNoOpenAi: number;
  skippedAiFailed: number;
  skippedOddTooLow: number;
  skippedErrors: number;
  built: number;
  afterOddFilter: number;
  reason: string;
};

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);
  private readonly openAiKey: string;
  private readonly openAiModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly predictionsService: PredictionsService,
    @Inject(forwardRef(() => FootballService))
    private readonly football: FootballService,
    @InjectRepository(GenerationMeta)
    private readonly generationMetaRepo: Repository<GenerationMeta>,
  ) {
    this.openAiKey = this.config.get<string>('OPENAI_API_KEY') || '';
    this.openAiModel = this.config.get<string>('OPENAI_MODEL') || 'gpt-4o-mini';
  }

  /**
   * Busca jogos futuros do dia, gera palpite por jogo (IA ou odds), evita duplicados e persiste.
   */
  async generateDailyPredictions(
    date?: string,
  ): Promise<GenerateDailyPredictionsResult> {
    const targetDate = date ?? this.predictionsService.today();
    this.logger.log(`Iniciando geração de prognósticos para ${targetDate}`);

    const matches = await this.football.getUpcomingMatchesForDate(targetDate);
    if (!matches.length) {
      this.logger.warn(
        `Nenhum jogo candidato (SCHEDULED/TIMED) para ${targetDate} após buscar partidas/odds.`,
      );
      await this.recordGenerationMeta(0);
      return {
        count: 0,
        date: targetDate,
        candidates: 0,
        skippedDuplicate: 0,
        skippedNoOdds: 0,
        skippedNoOpenAi: 0,
        skippedAiFailed: 0,
        skippedOddTooLow: 0,
        skippedErrors: 0,
        built: 0,
        afterOddFilter: 0,
        reason: 'SEM_PARTIDAS_CANDIDATAS',
      };
    }

    const pending: Partial<Prediction>[] = [];
    let skippedDuplicate = 0;
    let skippedNoOdds = 0;
    let skippedNoOpenAi = 0;
    let skippedAiFailed = 0;
    let skippedOddTooLow = 0;
    let skippedErrors = 0;

    for (const m of matches) {
      const mid = String(m.id);
      try {
        if (await this.predictionsService.existsForMatchOnDate(mid, targetDate)) {
          this.logger.debug(`Jogo ${mid}: prognóstico já existe; ignorado.`);
          skippedDuplicate += 1;
          continue;
        }

        const oddsOk = this.hasUsableOdds(m);
        let core: PredictionCore;
        if (oddsOk) {
          if (this.openAiKey) {
            try {
              core = await this.buildPredictionsWithAi(m);
            } catch (e) {
              this.logger.warn(
                `IA falhou para jogo ${mid} (${e instanceof Error ? e.message : e}); fallback por odds.`,
              );
              try {
                core = this.buildPredictionsFromOdds(m);
              } catch (e2) {
                this.logger.warn(
                  `Fallback por odds falhou para jogo ${mid} (${
                    e2 instanceof Error ? e2.message : e2
                  }); ignorado.`,
                );
                skippedErrors += 1;
                continue;
              }
            }
          } else {
            core = this.buildPredictionsFromOdds(m);
          }
        } else if (this.openAiKey) {
          try {
            core = await this.buildPredictionsWithAi(m);
          } catch (e) {
            this.logger.warn(
              `IA falhou para jogo ${mid} sem odds 1X2 (${
                e instanceof Error ? e.message : e
              }); ignorado.`,
            );
            skippedAiFailed += 1;
            continue;
          }
        } else {
          this.logger.warn(
            `Jogo ${mid}: sem odds 1X2 e sem OPENAI_API_KEY — não dá para gerar com o pipeline atual.`,
          );
          skippedNoOdds += 1;
          skippedNoOpenAi += 1;
          continue;
        }

        const apiOdd = this.pickOddForMarket(m, core.market);
        const probForMarket =
          core.market === 'HOME_WIN'
            ? core.probHome
            : core.market === 'DRAW'
              ? core.probDraw
              : core.probAway;
        const impliedFromAi = this.impliedDecimalOddFromProbability(probForMarket);
        const odd = apiOdd ?? impliedFromAi;
        if (odd == null || odd <= MIN_ODD_THRESHOLD) {
          this.logger.warn(
            `Jogo ${mid}: odd inválida (${odd}) para ${core.market}; ignorado.`,
          );
          skippedOddTooLow += 1;
          continue;
        }
        if (apiOdd == null && impliedFromAi != null) {
          this.logger.debug(
            `Jogo ${mid}: sem odd da API para ${core.market}; usando odd implícita estimada (~${impliedFromAi.toFixed(
              2,
            )}) a partir das probabilidades da IA.`,
          );
        }

        const probability =
          core.market === 'HOME_WIN'
            ? core.probHome
            : core.market === 'DRAW'
              ? core.probDraw
              : core.probAway;

        pending.push({
          matchId: mid,
          homeTeam: m.homeTeam.name,
          awayTeam: m.awayTeam.name,
          league: m.competition.name,
          startTime: new Date(m.utcDate),
          market: core.market,
          probability,
          odd,
          probHome: core.probHome,
          probDraw: core.probDraw,
          probAway: core.probAway,
          bestBet: core.market,
          analysis: core.analysis,
          minPlan: PlanType.FREE,
          predictionDate: targetDate,
        });
      } catch (e) {
        skippedErrors += 1;
        this.logger.error(
          `Erro ao processar jogo ${mid}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    const tiered = this.applyFreeVsPaidTiers(pending);
    const saved: Prediction[] = [];
    for (const row of tiered) {
      saved.push(await this.predictionsService.saveOne(row));
    }

    try {
      await this.recordGenerationMeta(saved.length);
    } catch (e) {
      this.logger.warn(
        `Meta de geração não gravada: ${e instanceof Error ? e.message : e}`,
      );
    }

    this.logger.log(
      `Geração concluída para ${targetDate}: ${saved.length} novo(s) prognóstico(s).`,
    );

    let reason: string;
    if (saved.length > 0) {
      reason = 'OK';
    } else if (pending.length === 0) {
      if (skippedDuplicate >= matches.length) {
        reason = 'TODOS_DUPLICADOS';
      } else if (skippedNoOdds >= matches.length && !this.openAiKey) {
        reason = 'SEM_ODDS_SEM_IA';
      } else if (skippedAiFailed >= matches.length) {
        reason = 'ERROS_IA';
      } else if (skippedErrors > 0) {
        reason = 'ERROS_PROCESSAMENTO';
      } else {
        reason = 'SEM_CANDIDATOS_VALIDOS';
      }
    } else if (tiered.length === 0) {
      reason = 'FILTRO_ODD_MINIMA';
    } else {
      reason = 'DESCONHECIDO';
    }

    return {
      count: saved.length,
      date: targetDate,
      candidates: matches.length,
      skippedDuplicate,
      skippedNoOdds,
      skippedNoOpenAi,
      skippedAiFailed,
      skippedOddTooLow,
      skippedErrors,
      built: pending.length,
      afterOddFilter: tiered.length,
      reason,
    };
  }

  /**
   * Uma chamada à OpenAI por partida; retorna probabilidades normalizadas e melhor mercado 1X2.
   */
  async buildPredictionsWithAi(match: ApiMatch): Promise<PredictionCore> {
    if (!this.openAiKey) {
      return this.buildPredictionsFromOdds(match);
    }

    const timeA = match.homeTeam.name;
    const timeB = match.awayTeam.name;
    const odds = this.football.getOddsMap(match);
    const oddsLine =
      odds.HOME_WIN != null &&
      odds.DRAW != null &&
      odds.AWAY_WIN != null &&
      !Number.isNaN(odds.HOME_WIN) &&
      !Number.isNaN(odds.DRAW) &&
      !Number.isNaN(odds.AWAY_WIN)
        ? `Dados de odds 1X2 (referência): ${JSON.stringify(odds)}`
        : 'Não há odds 1X2 disponíveis para este jogo na API; estime probabilidades com base em contexto geral do confronto (sem inventar odds numéricas).';

    const userPrompt = [
      'Você é um especialista em análise de futebol e apostas esportivas.',
      '',
      `Analise o jogo entre ${timeA} e ${timeB}.`,
      '',
      'Considere:',
      '',
      '* Probabilidades (odds)',
      '* Forma recente',
      '* Equilíbrio do confronto',
      '',
      oddsLine,
      '',
      'Responda SOMENTE em JSON no formato:',
      '',
      '{',
      `"match": "${timeA} x ${timeB}",`,
      '"prob_home_win": number,',
      '"prob_draw": number,',
      '"prob_away_win": number,',
      '"best_bet": string,',
      '"analysis": string',
      '}',
      '',
      'prob_*: use números entre 0 e 1 (somatório próximo de 1).',
      'best_bet: exatamente HOME_WIN, DRAW ou AWAY_WIN.',
      'analysis: português do Brasil, até 3 frases.',
    ].join('\n');

    const { data } = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: this.openAiModel,
        temperature: 0.25,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: userPrompt }],
      },
      {
        timeout: 30000,
        headers: {
          Authorization: `Bearer ${this.openAiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const content = data?.choices?.[0]?.message?.content as string | undefined;
    const parsed = this.parseAiJson(content);
    const market = this.normalizeBestBet(parsed.best_bet);
    if (!market) {
      throw new Error('Resposta IA sem best_bet válido');
    }

    let probHome: number;
    let probDraw: number;
    let probAway: number;
    if (
      parsed.prob_home_win != null &&
      parsed.prob_draw != null &&
      parsed.prob_away_win != null
    ) {
      [probHome, probDraw, probAway] = this.normalizeTriplet(
        Number(parsed.prob_home_win),
        Number(parsed.prob_draw),
        Number(parsed.prob_away_win),
      );
    } else {
      throw new Error('Resposta IA incompleta (prob_*)');
    }

    const analysis =
      typeof parsed.analysis === 'string' && parsed.analysis.trim()
        ? parsed.analysis.trim()
        : 'Análise gerada automaticamente com base nas odds e no contexto do confronto.';

    return { probHome, probDraw, probAway, market, analysis };
  }

  /** Fallback: favorito pela maior probabilidade implícita das odds. */
  buildPredictionsFromOdds(match: ApiMatch): PredictionCore {
    const o = this.football.getOddsMap(match);
    const implied = {
      HOME_WIN: o.HOME_WIN && o.HOME_WIN > 0 ? 1 / o.HOME_WIN : 0,
      DRAW: o.DRAW && o.DRAW > 0 ? 1 / o.DRAW : 0,
      AWAY_WIN: o.AWAY_WIN && o.AWAY_WIN > 0 ? 1 / o.AWAY_WIN : 0,
    };
    const sum = implied.HOME_WIN + implied.DRAW + implied.AWAY_WIN;
    if (sum <= 0) {
      throw new Error('Sem odds válidas para fallback');
    }
    const probHome = implied.HOME_WIN / sum;
    const probDraw = implied.DRAW / sum;
    const probAway = implied.AWAY_WIN / sum;

    let market: PredictionMarket = 'HOME_WIN';
    let best = probHome;
    if (probDraw > best) {
      market = 'DRAW';
      best = probDraw;
    }
    if (probAway > best) {
      market = 'AWAY_WIN';
      best = probAway;
    }

    const favLabel =
      market === 'HOME_WIN'
        ? `vitória de ${match.homeTeam.name}`
        : market === 'DRAW'
          ? 'empate'
          : `vitória de ${match.awayTeam.name}`;

    const analysis =
      `Palpite automático por odds implícitas (normalizadas). ` +
      `Favorito: ${favLabel} (~${(best * 100).toFixed(1)}% estimado).`;

    return { probHome, probDraw, probAway, market, analysis };
  }

  private hasUsableOdds(m: ApiMatch): boolean {
    const o = this.football.getOddsMap(m);
    const h = o.HOME_WIN != null && !Number.isNaN(o.HOME_WIN) && o.HOME_WIN > 0;
    const d = o.DRAW != null && !Number.isNaN(o.DRAW) && o.DRAW > 0;
    const a = o.AWAY_WIN != null && !Number.isNaN(o.AWAY_WIN) && o.AWAY_WIN > 0;
    return h && d && a;
  }

  private pickOddForMarket(
    m: ApiMatch,
    market: PredictionMarket,
  ): number | null {
    const odds = this.football.getOddsMap(m);
    const v = odds[market];
    if (v == null || Number.isNaN(v)) return null;
    return v;
  }

  /**
   * Quando a API não devolve odd decimal 1X2 (plano free), usa uma odd "implícita"
   * coerente com a probabilidade escolhida (ex.: IA), só para persistência/UI — não é odd real de casa.
   */
  private impliedDecimalOddFromProbability(p: number): number | null {
    if (p == null || Number.isNaN(p) || p <= 0 || p >= 1) return null;
    const implied = 1 / p;
    return Math.min(50, Math.max(1.01, implied));
  }

  private applyFreeVsPaidTiers(
    list: Partial<Prediction>[],
  ): Partial<Prediction>[] {
    const filtered = list.filter(
      (p) => p.odd != null && Number(p.odd) > MIN_ODD_THRESHOLD,
    );
    filtered.sort((a, b) => {
      const maxA = Math.max(
        Number(a.probHome ?? 0),
        Number(a.probDraw ?? 0),
        Number(a.probAway ?? 0),
      );
      const maxB = Math.max(
        Number(b.probHome ?? 0),
        Number(b.probDraw ?? 0),
        Number(b.probAway ?? 0),
      );
      return maxB - maxA;
    });
    return filtered.map((p, i) => ({
      ...p,
      minPlan: i < FREE_TIER_MAX_GAMES ? PlanType.FREE : PlanType.DAILY,
    }));
  }

  private parseAiJson(content: string | undefined): AiJsonPayload {
    if (!content) return {};
    try {
      return JSON.parse(content) as AiJsonPayload;
    } catch {
      return {};
    }
  }

  private normalizeBestBet(raw: string | undefined): PredictionMarket | null {
    if (!raw || typeof raw !== 'string') return null;
    const t = raw.trim().toUpperCase();
    if (t === 'HOME_WIN' || t === 'HOME' || t === '1' || t === 'CASA') {
      return 'HOME_WIN';
    }
    if (t === 'DRAW' || t === 'EMPATE' || t === 'X') {
      return 'DRAW';
    }
    if (t === 'AWAY_WIN' || t === 'AWAY' || t === '2' || t === 'FORA') {
      return 'AWAY_WIN';
    }
    return null;
  }

  private normalizeTriplet(
    h: number,
    d: number,
    a: number,
  ): [number, number, number] {
    let nh = h;
    let nd = d;
    let na = a;
    if (nh > 1 || nd > 1 || na > 1) {
      nh /= 100;
      nd /= 100;
      na /= 100;
    }
    const s = nh + nd + na;
    if (!Number.isFinite(s) || s <= 0) {
      return [1 / 3, 1 / 3, 1 / 3];
    }
    return [nh / s, nd / s, na / s];
  }

  private async recordGenerationMeta(count: number): Promise<void> {
    const id = 'singleton';
    let row = await this.generationMetaRepo.findOne({ where: { id } });
    if (!row) {
      row = this.generationMetaRepo.create({
        id,
        lastPredictionsAt: new Date(),
        lastCount: count,
      });
    } else {
      row.lastPredictionsAt = new Date();
      row.lastCount = count;
    }
    await this.generationMetaRepo.save(row);
  }
}
