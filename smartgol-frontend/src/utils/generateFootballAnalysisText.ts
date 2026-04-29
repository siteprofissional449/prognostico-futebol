import type { MatchDetail } from '../types';
import type { PredictionView } from '../types';
import { marketLabel } from './predictionLabels';

function fmtProb(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return 'nível médio';
  const n = typeof v === 'string' ? Number.parseFloat(v) : v;
  if (!Number.isFinite(n)) return 'nível médio';
  const pct = Math.round(n * 100);
  return `${pct}%`;
}

/** Parágrafos em linguagem natural para SEO quando não há análise longa da API. */
export function generateFootballAnalysisParagraphs(
  p: PredictionView,
  md: MatchDetail | null,
): string[] {
  const home = p.homeTeam.trim();
  const away = p.awayTeam.trim();
  const lg = p.league?.trim();

  const gH = md?.homeScore;
  const gA = md?.awayScore;

  let goalsPhrase =
    md != null &&
    typeof gH === 'number' &&
    typeof gA === 'number' &&
    !Number.isNaN(gH) &&
    !Number.isNaN(gA)
      ? `Placar até agora: ${gH} × ${gA}.`
      : '';

  const mkt = marketLabel(p.market ?? null);
  const conf =
    typeof p.confidence === 'number' && Number.isFinite(p.confidence) ?
      ` Confiança do modelo (${Number(p.confidence).toFixed(1)}/10) não é garantia de resultado.`
    : '';

  const p1 = `${home} contra ${away}${lg ? ` · ${lg}` : ''}. ${goalsPhrase} Leitura tática combinada com o mercado destacado (${mkt}).`;

  const p2 =
    `Probabilidades de referência: ${home} (${fmtProb(p.probHome)}), empate (${fmtProb(p.probDraw)}), ${away} (${fmtProb(p.probAway)}).${conf}`;

  return [p1, p2].filter((x) => x.replace(/\s/g, '').length > 0);
}

/** Um parágrafo sintético de “confrontos diretos” quando não há API H2H (placeholder honesto). */
export function generateH2HNarrativeParagraph(homeTeam: string, awayTeam: string): string {
  return (
    `${homeTeam} e ${awayTeam}: confrontos repetidos ao longo do calendário costumam apertar marcadores; para histórico H2H detalhado, complementa em fontes de estatísticas oficiais.`
  );
}
