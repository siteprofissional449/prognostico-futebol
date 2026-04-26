import { memo, useMemo } from 'react';
import { Card, Text, Group, Stack } from '@mantine/core';
import { IconTarget, IconPercentage } from '@tabler/icons-react';
import type { PredictionView } from '../types';
import classes from './GameCard.module.css';

function formatProb(p: number) {
  return `${(Number(p) * 100).toFixed(1)}%`;
}

function marketLabel(market: string | null) {
  if (!market) return '—';
  if (market === 'HOME_WIN') return 'Casa';
  if (market === 'DRAW') return 'Empate';
  if (market === 'AWAY_WIN') return 'Fora';
  if (market === 'OVER_25') return 'Over 2,5';
  if (market === 'OVER_2') return 'Mais 2 gols';
  if (market === 'UNDER_25') return 'Under 2,5';
  if (market === 'CORNERS_OVER') return 'Mais escanteios';
  if (market === 'CORNERS_UNDER') return 'Menos escanteios';
  return market;
}

type Props = { p: PredictionView };

function GameCardInner({ p }: Props) {
  const prob = useMemo(() => {
    if (p.probability == null) return 0;
    return typeof p.probability === 'string' ? parseFloat(p.probability) : p.probability;
  }, [p.probability]);
  const odd = useMemo(() => {
    if (p.odd == null) return 0;
    return typeof p.odd === 'string' ? parseFloat(p.odd) : p.odd;
  }, [p.odd]);

  return (
    <Card className={classes.card} shadow="none" padding={0} radius="md" withBorder={false}>
      <p className={classes.league}>{p.league}</p>
      <p className={classes.match}>
        {p.homeTeam} <span style={{ color: '#6b7280', fontWeight: 500 }}>×</span> {p.awayTeam}
      </p>
      <Group gap="xs" mb="sm" wrap="nowrap">
        <Group gap={4} wrap="nowrap">
          <IconTarget size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
          <Text size="sm" c="#9CA3AF" fw={500}>
            {marketLabel(p.market ?? null)}
          </Text>
        </Group>
      </Group>
      <div className={classes.row}>
        <Stack gap={2}>
          <Group gap={4} align="center">
            <IconPercentage size={14} color="#22c55e" />
            <Text className={classes.labelSm} component="span">
              Confiança
            </Text>
          </Group>
          <Text className={classes.prob}>{formatProb(prob)}</Text>
        </Stack>
        {odd > 0 && (
          <Stack gap={2} align="flex-end">
            <Text className={classes.labelSm}>Odd</Text>
            <Text className={classes.odd}>{odd.toFixed(2)}</Text>
          </Stack>
        )}
      </div>
    </Card>
  );
}

export const GameCard = memo(GameCardInner);
