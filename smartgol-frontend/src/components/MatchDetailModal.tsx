import { Modal, Text, Group, Stack, Divider } from '@mantine/core';
import type { MatchDetail } from '../types';

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export function MatchDetailModal({
  match,
  opened,
  onClose,
}: {
  match: MatchDetail | null;
  opened: boolean;
  onClose: () => void;
}) {
  if (!match) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Estatísticas do jogo"
      size="sm"
      centered
    >
      <Stack gap="md">
        <Text size="xs" c="dimmed" tt="uppercase">{match.league}</Text>
        <Group justify="center" gap="xl">
          <Text fw={700} size="lg">{match.homeTeam}</Text>
          <Text fw={700} size="xl" c="green.5">
            {match.homeScore} × {match.awayScore}
          </Text>
          <Text fw={700} size="lg">{match.awayTeam}</Text>
        </Group>
        <Text size="sm" c="dimmed">{formatTime(match.utcDate)}</Text>
        <Divider />
        <Group justify="space-between">
          <Text size="sm" c="dimmed">Status</Text>
          <Text size="sm">{match.status}</Text>
        </Group>
        {match.halfTime != null && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Placar no meio tempo</Text>
            <Text size="sm">{match.halfTime.home} × {match.halfTime.away}</Text>
          </Group>
        )}
        {match.winner !== 'DRAW' && (
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Vencedor</Text>
            <Text size="sm" fw={600}>
              {match.winner === 'HOME' ? match.homeTeam : match.awayTeam}
            </Text>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
