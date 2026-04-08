import { Card, Text, Group, Badge } from '@mantine/core';
import type { Prediction } from '../types';
import classes from './GameCard.module.css';

const planLabels: Record<string, string> = {
  FREE: 'Grátis',
  DAILY: 'Diário',
  WEEKLY: 'Semanal',
  PREMIUM: 'Premium',
  VIP: 'VIP',
};

const planColors: Record<string, string> = {
  FREE: 'green',
  DAILY: 'cyan',
  WEEKLY: 'blue',
  PREMIUM: 'violet',
  VIP: 'yellow',
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

export function GameCard({ p }: { p: Prediction }) {
  const prob = typeof p.probability === 'string' ? parseFloat(p.probability) : p.probability;
  const odd = typeof p.odd === 'string' ? parseFloat(p.odd) : p.odd;

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
      <Group justify="space-between" mt="md">
        <div>
          <Text size="xs" c="dimmed">Horário</Text>
          <Text size="sm">{formatTime(p.startTime)}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">Mercado</Text>
          <Text size="sm">{p.market === 'HOME_WIN' ? 'Casa vence' : p.market}</Text>
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
