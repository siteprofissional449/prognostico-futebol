import { Card, Text, Group, Badge } from '@mantine/core';
import type { PredictionView } from '../types';
import classes from './GameCard.module.css';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function marketLabel(market: string | null) {
  if (market === 'HOME_WIN') return 'Casa vence';
  if (market === 'DRAW') return 'Empate';
  if (market === 'AWAY_WIN') return 'Fora vence';
  return market ?? '—';
}

function statusBadge(status: PredictionView['resultStatus']) {
  if (status === 'GREEN') return <Badge color="green">Green</Badge>;
  if (status === 'RED') return <Badge color="red">Red</Badge>;
  return <Badge color="gray" variant="light">Pendente</Badge>;
}

export function PredictionHistoryCard({ p }: { p: PredictionView }) {
  const prob =
    p.probability == null
      ? null
      : typeof p.probability === 'string'
        ? parseFloat(p.probability)
        : p.probability;
  const odd =
    p.odd == null ? null : typeof p.odd === 'string' ? parseFloat(p.odd) : p.odd;

  return (
    <Card className={classes.card} shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Text size="xs" c="dimmed" tt="uppercase">{p.league}</Text>
        {statusBadge(p.resultStatus ?? null)}
      </Group>
      <Text fw={600} size="lg" mb="xs" className={classes.match}>
        {p.homeTeam} × {p.awayTeam}
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        Horário: {formatTime(p.startTime)}
        {p.finalScore ? ` · Placar: ${p.finalScore}` : ''}
      </Text>
      <Group justify="space-between" mt="md" wrap="wrap" gap="xs">
        <div>
          <Text size="xs" c="dimmed">Mercado</Text>
          <Text size="sm">{marketLabel(p.market)}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">Prob.</Text>
          <Text size="sm" fw={600} c="green.4">
            {prob != null ? `${(prob * 100).toFixed(1)}%` : '—'}
          </Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">Odd</Text>
          <Text size="sm" fw={600}>{odd != null ? odd.toFixed(2) : '—'}</Text>
        </div>
      </Group>
    </Card>
  );
}
