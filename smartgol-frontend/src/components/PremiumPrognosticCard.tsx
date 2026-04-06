import { useState } from 'react';
import { Card, Text, Group, Badge, Button, Collapse, Stack } from '@mantine/core';
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { AdminPrognostic, PlanType, PrognosticStatus } from '../types';

const planLabels: Record<PlanType, string> = {
  FREE: 'Grátis',
  PREMIUM: 'Premium',
  VIP: 'VIP',
};

const planColors: Record<PlanType, string> = {
  FREE: 'gray',
  PREMIUM: 'blue',
  VIP: 'yellow',
};

function statusMeta(s: PrognosticStatus) {
  if (s === 'WON') return { label: 'Green', color: 'green' as const };
  if (s === 'LOST') return { label: 'Red', color: 'red' as const };
  return { label: 'Pendente', color: 'yellow' as const };
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function PremiumPrognosticCard({ row }: { row: AdminPrognostic }) {
  const [open, setOpen] = useState(false);
  const st = statusMeta(row.status);
  const hasLongAnalysis = (row.analysis?.length ?? 0) > 160;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm" mb="xs">
        <div style={{ minWidth: 0 }}>
          <Text fw={700} size="lg" lh={1.3}>
            {row.homeTeam}{' '}
            <Text span c="dimmed" fw={500}>
              x
            </Text>{' '}
            {row.awayTeam}
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            {formatWhen(row.matchDate)}
          </Text>
        </div>
        <Group gap="xs" wrap="nowrap">
          <Badge variant="light" color={planColors[row.plan]} size="sm">
            {planLabels[row.plan]}
          </Badge>
          <Badge variant="light" color={st.color} size="sm">
            {st.label}
          </Badge>
        </Group>
      </Group>

      <Text size="sm" fw={600} c="green.4" mb={4}>
        Palpite: {row.prediction}
      </Text>
      <Text size="sm" c="dimmed">
        Odd sugerida: <strong style={{ color: 'var(--mantine-color-gray-2)' }}>{row.odd}</strong>
      </Text>

      {row.analysis ? (
        <Stack gap="xs" mt="md">
          {hasLongAnalysis ? (
            <>
              <Collapse in={open}>
                <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                  {row.analysis}
                </Text>
              </Collapse>
              <Button
                variant="subtle"
                size="xs"
                px={0}
                rightSection={open ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                onClick={() => setOpen((o) => !o)}
              >
                {open ? 'Recolher análise' : 'Ver análise completa'}
              </Button>
            </>
          ) : (
            <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
              {row.analysis}
            </Text>
          )}
        </Stack>
      ) : null}
    </Card>
  );
}
