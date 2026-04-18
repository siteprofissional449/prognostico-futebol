import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { isAxiosError } from 'axios';
import { FootballService, ApiMatch } from '../football/football.service';
import { GenerationMeta } from '../football/generation-meta.entity';
import { PredictionsService } from './predictions.service';
import { Prediction, PlanType } from './prediction.entity';

export type PredictionMarket =
  | 'HOME_WIN'
  | 'DRAW'
  | 'AWAY_WIN'
  | 'OVER_25'
  | 'UNDER_25'
  | 'CORNERS_OVER'
  | 'CORNERS_UNDER';

/** Odd mínima publicada (regra conservadora; configurável). */
const MIN_PUBLISHED_ODD =
  Number(process.env.MIN_PREDICTION_ODD) > 1
    ? Number(process.env.MIN_PREDICTION_ODD)
    : 1.65;
const FREE_TIER_MAX_GAMES = 5;
const BATCH_MAX_MATCHES = 22;
const BATCH_MAX_PICKS = 8;
const MIN_CONFIDENCE_AI = 58;

interface AiBatchPick {
  matchId: number;
  market: string;
  confidence: number;
  analysis: string;
  prediction_pt?: string;
}

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
  /** Mercados 1X2 no legado; lote conservador pode usar todos. */
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
  /** Primeira mensagem de falha da OpenAI (útil no admin sem abrir logs). */
  aiErrorSample: string | null;
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
    const trimmed = date?.trim();
    const tz = this.config.get<string>('CRON_TZ') || 'America/Sao_Paulo';
    const targetDate =
      trimmed ||
      new Date().toLocaleDateString('sv-SE', { timeZone: tz });
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
        aiErrorSample: null,
      };
    }

    const pending: Partial<Prediction>[] = [];
    let skippedDuplicate = 0;
    let skippedNoOdds = 0;
    let skippedNoOpenAi = 0;
    let skippedAiFailed = 0;
    let skippedOddTooLow = 0;
    let skippedErrors = 0;
    let aiErrorSample: string | null = null;

    let batchHadPicks = false;
    if (this.openAiKey) {
      try {
        const batch = await this.generateConservativeBatchWithAi(matches, targetDate);
        if (batch.length > 0) batchHadPicks = true;
        for (const row of batch) {
          const mid = String(row.matchId);
          try {
            if (await this.predictionsService.existsForMatchOnDate(mid, targetDate)) {
              skippedDuplicate += 1;
              continue;
            }
            pending.push(row);
          } catch (e) {
            skippedErrors += 1;
            this.logger.error(
              `Erro ao registar palpite do lote (${mid}): ${
                e instanceof Error ? e.message : e
              }`,
            );
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!aiErrorSample) aiErrorSample = msg.slice(0, 280);
        this.logger.warn(`IA conservadora (lote): ${msg}`);
      }
    }

    if (!batchHadPicks) {
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
              const msg = e instanceof Error ? e.message : String(e);
              if (!aiErrorSample) aiErrorSample = msg.slice(0, 280);
              this.logger.warn(
                `IA falhou para jogo ${mid} sem odds 1X2 (${msg}); ignorado.`,
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

          const apiOdd = this.resolveOddForMarket(m, core.market);
          const probForMarket =
            core.market === 'HOME_WIN'
              ? core.probHome
              : core.market === 'DRAW'
                ? core.probDraw
                : core.probAway;
          const impliedFromAi =
            this.impliedDecimalOddFromProbability(probForMarket);
          const odd = apiOdd ?? impliedFromAi;
          if (odd == null || odd < MIN_PUBLISHED_ODD) {
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
            homeTeam: m.homeTeam?.name ?? '—',
            awayTeam: m.awayTeam?.name ?? '—',
            league: m.competition?.name ?? '—',
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
      aiErrorSample,
    };
  }

  /**
   * Uma chamada à OpenAI por partida; retorna probabilidades normalizadas e melhor mercado 1X2.
   */
  async buildPredictionsWithAi(match: ApiMatch): Promise<PredictionCore> {
    if (!this.openAiKey) {
      return this.buildPredictionsFromOdds(match);
    }

    const timeA = match.homeTeam?.name ?? 'Mandante';
    const timeB = match.awayTeam?.name ?? 'Visitante';
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

    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      Authorization: `Bearer ${this.openAiKey}`,
      'Content-Type': 'application/json',
    };
    const baseBody = {
      model: this.openAiModel,
      temperature: 0.25,
      messages: [{ role: 'user', content: userPrompt }],
    };

    let data: {
      choices?: Array<{ message?: { content?: string } }>;
    };
    try {
      const res = await axios.post(
        url,
        { ...baseBody, response_format: { type: 'json_object' as const } },
        { timeout: 45000, headers },
      );
      data = res.data;
    } catch (first) {
      if (isAxiosError(first) && first.response?.status === 400) {
        this.logger.warn(
          `OpenAI rejeitou json_mode; nova tentativa sem response_format (${
            (first.response?.data as { error?: { message?: string } })?.error
              ?.message || first.message
          }).`,
        );
        const res = await axios.post(url, baseBody, { timeout: 45000, headers });
        data = res.data;
      } else {
        throw new Error(this.extractOpenAiErrorMessage(first));
      }
    }

    const content = data?.choices?.[0]?.message?.content as string | undefined;
    const parsed = this.parseAiResponse(content);
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

    let market =
      this.normalizeBestBet(parsed.best_bet) ??
      this.inferMarketFromProbs(probHome, probDraw, probAway);
    if (!market) {
      throw new Error('Resposta IA sem best_bet válido nem probabilidades utilizáveis');
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

    const hn = match.homeTeam?.name ?? 'Mandante';
    const an = match.awayTeam?.name ?? 'Visitante';
    const favLabel =
      market === 'HOME_WIN'
        ? `vitória de ${hn}`
        : market === 'DRAW'
          ? 'empate'
          : `vitória de ${an}`;

    const analysis =
      `Palpite automático por odds implícitas (normalizadas). ` +
      `Favorito: ${favLabel} (~${(best * 100).toFixed(1)}% estimado).`;

    return { probHome, probDraw, probAway, market, analysis };
  }

  /**
   * Uma chamada OpenAI com as partidas do dia: escolhe poucos jogos + um mercado conservador
   * (1X2, totais 2.5, cantos) com odd na API ≥ MIN_PUBLISHED_ODD.
   */
  private async generateConservativeBatchWithAi(
    matches: ApiMatch[],
    targetDate: string,
  ): Promise<Partial<Prediction>[]> {
    if (!this.openAiKey) return [];

    const slice = matches.slice(0, BATCH_MAX_MATCHES);
    const partidas = slice.map((m) => ({
      id: m.id,
      homeTeam: m.homeTeam?.name ?? 'Mandante',
      awayTeam: m.awayTeam?.name ?? 'Visitante',
      league: m.competition?.name ?? '—',
      utcDate: m.utcDate,
      odds: this.football.getExtendedOddsMap(m),
    }));

    const system = [
      'És um analista de futebol conservador. Recebes JSON com partidas e odds parciais da API.',
      'Deves devolver APENAS JSON (objeto com chave "picks" array).',
      '',
      'Regras:',
      `- Escolhe no máximo ${BATCH_MAX_PICKS} jogos do dia com maior probabilidade de acerto (não uses todos).`,
      '- Prioriza palpites seguros; evita confrontos muito equilibrados sem valor claro.',
      '- Para cada escolha, UM mercado entre EXATAMENTE estes códigos:',
      '  HOME_WIN | DRAW | AWAY_WIN | OVER_25 | UNDER_25 | CORNERS_OVER | CORNERS_UNDER',
      '  (OVER_25 = mais de 2.5 golos; UNDER_25 = menos de 2.5; CORNERS_* = mais/menos cantos na linha disponível nas odds).',
      '- Só podes escolher um mercado se a odd correspondente em "odds" existir e for >= ' +
        MIN_PUBLISHED_ODD +
        '. Se não houver odd na API para esse mercado, não uses esse mercado nessa partida.',
      '- "confidence" inteiro 55–92 (maior = mais confiança). Sê modesto: raramente acima de 88.',
      '- "analysis": português do Brasil, UMA frase curta (máx. 160 caracteres), clara para leigo.',
      '- "prediction_pt": rótulo curto em PT (ex.: "Casa vence", "Mais de 2.5 gols").',
      '- Ordena mentalmente por maior confiança; o array "picks" deve vir do mais confiante ao menos.',
      '- Não inventes odds: usa só as chaves numéricas enviadas em odds.',
    ].join('\n');

    const user = JSON.stringify(
      { partidas, minOdd: MIN_PUBLISHED_ODD, maxPicks: BATCH_MAX_PICKS },
      null,
      0,
    );

    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      Authorization: `Bearer ${this.openAiKey}`,
      'Content-Type': 'application/json',
    };
    const baseBody = {
      model: this.openAiModel,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };

    let data: { choices?: Array<{ message?: { content?: string } }> };
    try {
      const res = await axios.post(
        url,
        { ...baseBody, response_format: { type: 'json_object' as const } },
        { timeout: 120000, headers },
      );
      data = res.data;
    } catch (first) {
      if (isAxiosError(first) && first.response?.status === 400) {
        const res = await axios.post(url, baseBody, { timeout: 120000, headers });
        data = res.data;
      } else {
        throw new Error(this.extractOpenAiErrorMessage(first));
      }
    }

    const content = data?.choices?.[0]?.message?.content as string | undefined;
    const picks = this.parseBatchPicksJson(content);
    const byId = new Map(slice.map((m) => [m.id, m]));
    const out: Partial<Prediction>[] = [];

    for (const pick of picks) {
      const m = byId.get(pick.matchId);
      if (!m) continue;
      const market = this.normalizeExtendedMarket(pick.market);
      if (!market) continue;
      const odd = this.resolveOddForMarket(m, market);
      if (odd == null || odd < MIN_PUBLISHED_ODD) continue;
      let conf = Math.round(Number(pick.confidence));
      if (!Number.isFinite(conf)) continue;
      conf = Math.min(92, Math.max(MIN_CONFIDENCE_AI, conf));
      const probability = conf / 100;
      const triplet = this.impliedTripletFrom1x2IfAny(m);
      const analysis = this.clampAnalysisText(
        pick.analysis || pick.prediction_pt || '',
      );

      out.push({
        matchId: String(pick.matchId),
        homeTeam: m.homeTeam?.name ?? '—',
        awayTeam: m.awayTeam?.name ?? '—',
        league: m.competition?.name ?? '—',
        startTime: new Date(m.utcDate),
        market,
        probability,
        odd,
        probHome: triplet?.h ?? null,
        probDraw: triplet?.d ?? null,
        probAway: triplet?.a ?? null,
        bestBet: market,
        analysis,
        minPlan: PlanType.FREE,
        predictionDate: targetDate,
      });
    }

    out.sort(
      (a, b) => Number(b.probability ?? 0) - Number(a.probability ?? 0),
    );
    return out.slice(0, BATCH_MAX_PICKS);
  }

  private impliedTripletFrom1x2IfAny(
    m: ApiMatch,
  ): { h: number; d: number; a: number } | null {
    if (!this.hasUsableOdds(m)) return null;
    try {
      const c = this.buildPredictionsFromOdds(m);
      return { h: c.probHome, d: c.probDraw, a: c.probAway };
    } catch {
      return null;
    }
  }

  private clampAnalysisText(s: string): string {
    const t = s.trim().replace(/\s+/g, ' ');
    if (t.length <= 200) return t;
    return `${t.slice(0, 199).trim()}…`;
  }

  private parseBatchPicksJson(content: string | undefined): AiBatchPick[] {
    if (!content?.trim()) return [];
    let s = content.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    let obj: unknown;
    try {
      obj = JSON.parse(s);
    } catch {
      const i = s.indexOf('{');
      const j = s.lastIndexOf('}');
      if (i < 0 || j <= i) return [];
      try {
        obj = JSON.parse(s.slice(i, j + 1));
      } catch {
        return [];
      }
    }
    if (!obj || typeof obj !== 'object') return [];
    const root = obj as Record<string, unknown>;
    const raw = root.picks ?? root.items ?? root.prognosticos;
    if (!Array.isArray(raw)) return [];
    const out: AiBatchPick[] = [];
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const matchId = Number(r.matchId ?? r.id ?? r.match_id);
      if (!Number.isFinite(matchId)) continue;
      const market = String(r.market ?? r.mercado ?? '').trim();
      const confidence = Number(r.confidence ?? r.confianca);
      const analysis = String(r.analysis ?? r.explicacao ?? '').trim();
      const prediction_pt = r.prediction_pt
        ? String(r.prediction_pt)
        : r.prediction
          ? String(r.prediction)
          : undefined;
      if (!market) continue;
      out.push({
        matchId,
        market,
        confidence,
        analysis,
        prediction_pt,
      });
    }
    return out;
  }

  private normalizeExtendedMarket(raw: string): PredictionMarket | null {
    const t = raw.trim().toUpperCase().replace(/\s+/g, '_');
    const aliases: Record<string, PredictionMarket> = {
      HOME_WIN: 'HOME_WIN',
      DRAW: 'DRAW',
      AWAY_WIN: 'AWAY_WIN',
      '1': 'HOME_WIN',
      '2': 'AWAY_WIN',
      X: 'DRAW',
      CASA_VENCE: 'HOME_WIN',
      EMPATE: 'DRAW',
      FORA_VENCE: 'AWAY_WIN',
      OVER_25: 'OVER_25',
      OVER25: 'OVER_25',
      O25: 'OVER_25',
      MAIS_DE_2_5: 'OVER_25',
      MAIS_2_5: 'OVER_25',
      UNDER_25: 'UNDER_25',
      UNDER25: 'UNDER_25',
      U25: 'UNDER_25',
      MENOS_DE_2_5: 'UNDER_25',
      MENOS_2_5: 'UNDER_25',
      CORNERS_OVER: 'CORNERS_OVER',
      CORNERSOVER: 'CORNERS_OVER',
      MAIS_ESCANTEIOS: 'CORNERS_OVER',
      CORNERS_UNDER: 'CORNERS_UNDER',
      CORNERSUNDER: 'CORNERS_UNDER',
      MENOS_ESCANTEIOS: 'CORNERS_UNDER',
    };
    return aliases[t] ?? null;
  }

  private hasUsableOdds(m: ApiMatch): boolean {
    const o = this.football.getOddsMap(m);
    const h = o.HOME_WIN != null && !Number.isNaN(o.HOME_WIN) && o.HOME_WIN > 0;
    const d = o.DRAW != null && !Number.isNaN(o.DRAW) && o.DRAW > 0;
    const a = o.AWAY_WIN != null && !Number.isNaN(o.AWAY_WIN) && o.AWAY_WIN > 0;
    return h && d && a;
  }

  private resolveOddForMarket(
    m: ApiMatch,
    market: PredictionMarket,
  ): number | null {
    const ext = this.football.getExtendedOddsMap(m);
    const v = ext[market];
    if (v == null || Number.isNaN(Number(v))) return null;
    return Number(v);
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
      (p) => p.odd != null && Number(p.odd) >= MIN_PUBLISHED_ODD,
    );
    filtered.sort((a, b) => {
      const pa = Number(a.probability ?? 0);
      const pb = Number(b.probability ?? 0);
      if (pb !== pa) return pb - pa;
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

  private extractOpenAiErrorMessage(err: unknown): string {
    if (isAxiosError(err)) {
      const body = err.response?.data as
        | { error?: { message?: string }; message?: string }
        | undefined;
      const m = body?.error?.message || body?.message || err.message;
      return m || 'Erro HTTP na OpenAI';
    }
    return err instanceof Error ? err.message : String(err);
  }

  /** Aceita JSON puro, ```json fences```, chaves camelCase e objeto aninhado. */
  private parseAiResponse(content: string | undefined): AiJsonPayload {
    if (!content?.trim()) return {};
    let s = content.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    let obj: unknown;
    try {
      obj = JSON.parse(s);
    } catch {
      const i = s.indexOf('{');
      const j = s.lastIndexOf('}');
      if (i < 0 || j <= i) return {};
      try {
        obj = JSON.parse(s.slice(i, j + 1));
      } catch {
        return {};
      }
    }
    if (!obj || typeof obj !== 'object') return {};
    const r = obj as Record<string, unknown>;
    const nest = r.prediction ?? r.result ?? r.data;
    const src =
      nest && typeof nest === 'object'
        ? { ...r, ...(nest as Record<string, unknown>) }
        : r;
    const num = (v: unknown): number | undefined => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const str = (v: unknown): string | undefined =>
      typeof v === 'string' && v.trim() ? v.trim() : undefined;
    return {
      match: str(src.match),
      prob_home_win:
        num(src.prob_home_win) ??
        num(src.probHomeWin) ??
        num(src.home_win) ??
        num(src.homeWin),
      prob_draw:
        num(src.prob_draw) ??
        num(src.probDraw) ??
        num(src.draw_prob),
      prob_away_win:
        num(src.prob_away_win) ??
        num(src.probAwayWin) ??
        num(src.away_win) ??
        num(src.awayWin),
      best_bet:
        str(src.best_bet) ?? str(src.bestBet) ?? str(src.pick) ?? str(src.mercado),
      analysis: str(src.analysis) ?? str(src.resumo) ?? str(src.summary),
    };
  }

  private inferMarketFromProbs(
    h: number,
    d: number,
    a: number,
  ): PredictionMarket | null {
    if (![h, d, a].every((x) => Number.isFinite(x))) return null;
    if (h >= d && h >= a) return 'HOME_WIN';
    if (d >= h && d >= a) return 'DRAW';
    return 'AWAY_WIN';
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
