import { Card, Text, Group, Badge } from '@mantine/core';
import type { MatchResult } from '../types';
import classes from './ResultCard.module.css';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function ResultCard({
  match,
  onClick,
}: {
  match: MatchResult;
  onClick?: () => void;
}) {
  const isClickable = !!onClick;
  return (
    <Card
      className={classes.card}
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      style={{ cursor: isClickable ? 'pointer' : undefined }}
      onClick={onClick}
    >
      <Text size="xs" c="dimmed" tt="uppercase" mb="xs">
        {match.league}
      </Text>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text fw={600} size="sm" className={classes.team} style={{ textAlign: 'right' }}>
          {match.homeTeam}
        </Text>
        <Group gap="xs" wrap="nowrap" className={classes.score}>
          <Text
            fw={700}
            size="lg"
            className={match.winner === 'HOME' ? classes.winner : undefined}
          >
            {match.homeScore}
          </Text>
          <Text size="sm" c="dimmed">×</Text>
          <Text
            fw={700}
            size="lg"
            className={match.winner === 'AWAY' ? classes.winner : undefined}
          >
            {match.awayScore}
          </Text>
        </Group>
        <Text fw={600} size="sm" className={classes.team}>
          {match.awayTeam}
        </Text>
      </Group>
      <Group justify="space-between" mt="xs">
        <Text size="xs" c="dimmed">{formatTime(match.utcDate)}</Text>
        {match.halfTime != null && (
          <Badge size="xs" variant="light" color="gray">
            MT: {match.halfTime.home}-{match.halfTime.away}
          </Badge>
        )}
      </Group>
    </Card>
  );
}
