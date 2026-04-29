/** Rótulos de mercado iguais ao GameCard para coerência em toda a app. */
export function marketLabel(market: string | null): string {
  if (!market) return '—';
  if (market === 'HOME_WIN') return 'Vitória casa';
  if (market === 'DRAW') return 'Empate';
  if (market === 'AWAY_WIN') return 'Vitória fora';
  if (market === 'OVER_25') return 'Over 2,5 gols';
  if (market === 'OVER_2') return 'Mais de 2 gols';
  if (market === 'UNDER_25') return 'Under 2,5 gols';
  if (market === 'CORNERS_OVER') return 'Mais escanteios';
  if (market === 'CORNERS_UNDER') return 'Menos escanteios';
  return market;
}

export function formatProb(p: number | null): string {
  if (p == null) return '—';
  const n = typeof p === 'string' ? Number.parseFloat(p) : p;
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}
