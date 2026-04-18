import { Card, Text, Group, Button, Stack, ThemeIcon } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import type { PredictionView } from '../types';
import classes from './GameCard.module.css';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function PremiumLockCard({ p }: { p: PredictionView }) {
  return (
    <Card className={classes.card} shadow="sm" padding="lg" radius="md" withBorder opacity={0.92}>
      <Group justify="space-between" mb="xs">
        <Text size="xs" c="dimmed" tt="uppercase">{p.league}</Text>
        <ThemeIcon variant="light" color="violet" size="sm" radius="xl">
          <IconLock size={14} />
        </ThemeIcon>
      </Group>
      <Text fw={600} size="lg" mb="md" className={classes.match}>
        {p.homeTeam} × {p.awayTeam}
      </Text>
      <Text size="xs" c="dimmed" mb="xs">Horário: {formatTime(p.startTime)}</Text>
      <Stack gap="sm" mt="md">
        <Text size="sm" c="dimmed">
          🔒 Conteúdo Premium
        </Text>
        <Text size="xs" c="dimmed">
          Assine um plano para ver palpite, odds sugeridas e análise deste jogo.
        </Text>
        <Button component={Link} to="/planos" variant="light" color="violet" size="sm">
          Ver mais prognósticos
        </Button>
      </Stack>
    </Card>
  );
}
