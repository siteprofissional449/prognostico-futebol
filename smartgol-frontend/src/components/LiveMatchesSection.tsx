import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Text,
  Group,
  Badge,
  SimpleGrid,
  Loader,
  Alert,
  Paper,
  Title,
  ThemeIcon,
} from '@mantine/core';
import { IconBroadcast } from '@tabler/icons-react';
import { getLiveMatches } from '../api/football';
import type { LiveMatchInfo } from '../types';
import classes from './ResultCard.module.css';

const POLL_MS = 60_000;

function statusLabel(s: string) {
  const u = s.toUpperCase();
  if (u === 'IN_PLAY') return 'Ao vivo';
  if (u === 'PAUSED') return 'Interrompido';
  return s;
}

function liveBadgeColor(s: string) {
  const u = s.toUpperCase();
  if (u === 'PAUSED') return 'yellow';
  return 'red';
}

type Props = {
  onMatchClick?: (matchId: number) => void;
};

/**
 * Dados vêm de GET /football/live (cache no backend ~1 min).
 * O browser só pede ao teu domínio; a API football-data fica no servidor.
 */
export function LiveMatchesSection({ onMatchClick }: Props) {
  const [items, setItems] = useState<LiveMatchInfo[]>([]);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    return getLiveMatches()
      .then((res) => {
        setItems(Array.isArray(res.items) ? res.items : []);
        setRefreshedAt(res.refreshedAt || null);
        setError(null);
      })
      .catch((e) => {
        setError(
          e?.message || 'Não foi possível carregar jogos ao vivo.',
        );
      });
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load().finally(() => {
      if (alive) setLoading(false);
    });
    const id = window.setInterval(() => {
      void load();
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [load]);

  const updatedLabel = (() => {
    if (!refreshedAt) return null;
    try {
      const t = new Date(refreshedAt).getTime();
      if (Number.isNaN(t) || t <= 0) return null;
      return new Date(refreshedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return null;
    }
  })();

  return (
    <Paper withBorder p="md" radius="md" mb="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap" mb="md" gap="sm">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size="lg" variant="light" color="red" radius="md">
            <IconBroadcast size={22} />
          </ThemeIcon>
          <div>
            <Title order={3}>Ao vivo</Title>
            <Text size="sm" c="dimmed">
              Jogos em curso nas principais ligas. O servidor atualiza o placar
              aproximadamente a cada 1 minuto; esta página pede de novo a cada
              1 min.
            </Text>
            {updatedLabel && (
              <Text size="xs" c="dimmed" mt={4}>
                Última atualização do servidor: {updatedLabel}
              </Text>
            )}
          </div>
        </Group>
      </Group>

      {error && (
        <Alert color="orange" variant="light" mb="md" title="Ao vivo indisponível">
          {error}{' '}
          <Text size="sm" c="dimmed" mt="xs" component="span" display="block">
            Confirme se a API está no ar e se <code>FOOTBALL_API_KEY</code> está
            definida no backend (ex.: Railway).
          </Text>
        </Alert>
      )}

      {loading && !error ? (
        <Group justify="center" py="md">
          <Loader size="md" />
        </Group>
      ) : items.length === 0 && !error ? (
        <Text size="sm" c="dimmed">
          Nenhum jogo ao vivo neste momento (ou nenhum nas competições
          acompanhadas — ex.: fora de hora de jogos).
        </Text>
      ) : !error && items.length > 0 ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {items.map((m) => {
            const clickable = !!onMatchClick;
            return (
              <Card
                key={m.id}
                className={classes.card}
                shadow="sm"
                padding="md"
                radius="md"
                withBorder
                style={{
                  borderColor: 'var(--mantine-color-red-3)',
                  cursor: clickable ? 'pointer' : undefined,
                }}
                onClick={clickable ? () => onMatchClick!(m.id) : undefined}
              >
                <Group justify="space-between" mb="xs">
                  <Text size="xs" c="dimmed" tt="uppercase" lineClamp={1}>
                    {m.league}
                  </Text>
                  <Group gap="xs">
                    {m.minute != null && m.status === 'IN_PLAY' && (
                      <Badge size="sm" color="red" variant="filled">
                        {m.minute}&apos;
                      </Badge>
                    )}
                    <Badge size="sm" color={liveBadgeColor(m.status)} variant="light">
                      {statusLabel(m.status)}
                    </Badge>
                  </Group>
                </Group>
                <Group justify="space-between" wrap="nowrap" gap="sm" align="center">
                  <Text fw={600} size="sm" style={{ textAlign: 'right', flex: 1 }} lineClamp={2}>
                    {m.homeTeam}
                  </Text>
                  <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                    <Text fw={800} size="xl" c="teal.4">
                      {m.homeScore}
                    </Text>
                    <Text size="sm" c="dimmed" fw={600}>
                      ×
                    </Text>
                    <Text fw={800} size="xl" c="teal.4">
                      {m.awayScore}
                    </Text>
                  </Group>
                  <Text fw={600} size="sm" style={{ textAlign: 'left', flex: 1 }} lineClamp={2}>
                    {m.awayTeam}
                  </Text>
                </Group>
                {clickable && (
                  <Text size="xs" c="dimmed" mt="sm">
                    Toque para detalhe do jogo
                  </Text>
                )}
              </Card>
            );
          })}
        </SimpleGrid>
      ) : null}
    </Paper>
  );
}
