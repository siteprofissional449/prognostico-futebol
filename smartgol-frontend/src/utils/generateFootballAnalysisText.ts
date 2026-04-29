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

  let goalsLine =
    md != null &&
    typeof gH === 'number' &&
    typeof gA === 'number' &&
    !Number.isNaN(gH) &&
    !Number.isNaN(gA)
      ? `Neste cenário já jogado ou em curso, o placar registado até agora foi ${home} ${gH} × ${gA} ${away}. Isso sintetiza a dinâmica ofensiva e defensiva instantânea.`
      : `Sem placar oficial consolidado nos nossos dados neste momento, o foco recai sobre o que os modelos probabilísticos e o momento da competição sugerem para o confronto.`;

  const mkt = marketLabel(p.market ?? null);
  const p1 = `${home} recebe ${away}${lg ? ` na ${lg}` : ''}; trata‑se de um confronto onde o cenário táctico típico (transições e ritmo das duas formações) pesa forte na leitura. ${goalsLine}`;

  const p2 =
    `A tendência probabilística atual aponta ` +
    `${fmtProb(p.probHome)} para resultado favorável a ${home}, ` +
    `${fmtProb(p.probDraw)} para empate e ` +
    `${fmtProb(p.probAway)} para resultado favorável a ${away}. Estes valores traduzem a forma recente e o equilíbrio implícito do mercado de ${mkt}.`;

  let p3 = `Em termos de forma, o cenário combinado sugere duelo disputado onde pequenas ausências ou desgaste físico ao longo do calendário podem decidir períodos‑chave.`;
  if (typeof p.confidence === 'number' && Number.isFinite(p.confidence)) {
    p3 += ` O grau de confiança combinado do modelo (nota até 10: ${Number(p.confidence).toFixed(1)}) deve ser lidos como probabilidade técnica, não promessa — jogo sempre imprevisível dentro das quatro linhas.`;
  }

  return [p1, p2, p3].filter(Boolean);
}

/** Um parágrafo sintético de “confrontos diretos” quando não há API H2H (placeholder honesto). */
export function generateH2HNarrativeParagraph(homeTeam: string, awayTeam: string): string {
  return (
    `${homeTeam} e ${awayTeam} cruzam-se num cenário onde o resultado recente pode iludir sobre equilíbrio real entre estilos: empates cerrados ou vitórias apertadas costumam ser frequentes quando as equipas já se estudam no calendário. ` +
    `Para profundidade estatística de confrontos diretos (últimos 5 anos, casa/fora ou competição‑a‑competição), o ideal é complementar esta leitura com dados completos quando integrados ao serviço.`
  );
}
