import { Card, Text, Group, Badge } from '@mantine/core';
import type { PredictionView } from '../types';
import classes from './GameCard.module.css';

const planLabels: Record<string, string> = {
  FREE: 'Grátis',
  DAILY: 'Diário',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  PREMIUM: 'Mensal',
};

const planColors: Record<string, string> = {
  FREE: 'green',
  DAILY: 'cyan',
  WEEKLY: 'blue',
  MONTHLY: 'violet',
  PREMIUM: 'violet',
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function formatProb(p: number) {
  return `${(Number(p) * 100).toFixed(1)}%`;
}

function marketLabel(market: string) {
  if (market === 'HOME_WIN') return 'Casa vence';
  if (market === 'DRAW') return 'Empate';
  if (market === 'AWAY_WIN') return 'Fora vence';
  if (market === 'OVER_25') return 'Mais de 2.5 gols';
  if (market === 'UNDER_25') return 'Menos de 2.5 gols';
  if (market === 'CORNERS_OVER') return 'Mais escanteios';
  if (market === 'CORNERS_UNDER') return 'Menos escanteios';
  return market;
}

/** Resumo curto para a UI (uma frase). */
function briefAnalysis(text: string | null | undefined, max = 150): string | null {
  if (!text?.trim()) return null;
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

export function GameCard({ p }: { p: PredictionView }) {
  const prob =
    p.probability == null
      ? 0
      : typeof p.probability === 'string'
        ? parseFloat(p.probability)
        : p.probability;
  const odd =
    p.odd == null ? 0 : typeof p.odd === 'string' ? parseFloat(p.odd) : p.odd;
  const blurb = briefAnalysis(p.analysis);

  return (
    <Card className={classes.card} shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Text size="xs" c="dimmed" tt="uppercase">{p.league}</Text>
        <Badge size="sm" color={planColors[p.minPlan] ?? 'gray'} variant="light">
          {planLabels[p.minPlan] ?? p.minPlan}
        </Badge>
      </Group>
      <Text fw={600} size="lg" mb="xs" className={classes.match}>
        {p.homeTeam} × {p.awayTeam}
      </Text>
      {blurb && (
        <Text size="sm" c="dimmed" mt={4} mb="sm" style={{ lineHeight: 1.45 }}>
          {blurb}
        </Text>
      )}
      <Group justify="space-between" mt="md">
        <div>
          <Text size="xs" c="dimmed">Horário</Text>
          <Text size="sm">{formatTime(p.startTime)}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">Mercado</Text>
          <Text size="sm">{marketLabel(p.market ?? '')}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">Probabilidade</Text>
          <Text size="sm" fw={600} c="green.4">{formatProb(prob)}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">Odd</Text>
          <Text size="sm" fw={600}>{odd.toFixed(2)}</Text>
        </div>
      </Group>
    </Card>
  );
}
