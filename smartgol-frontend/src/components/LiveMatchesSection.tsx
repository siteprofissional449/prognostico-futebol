import { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { Text, Group, Loader, Alert, ThemeIcon, Badge } from '@mantine/core';
import { IconBroadcast } from '@tabler/icons-react';
import { getLiveMatches } from '../api/football';
import type { LiveMatchInfo } from '../types';
import styles from './LiveMatchesSection.module.css';

const POLL_MS = 60_000;

type Props = {
  onMatchClick?: (matchId: number) => void;
};

function LiveMatchesSectionInner({ onMatchClick }: Props) {
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
        setError(e?.message || 'Sem dados ao vivo.');
      });
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void load().finally(() => {
      if (alive) setLoading(false);
    });
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [load]);

  const timeLine = useMemo(() => {
    if (!refreshedAt) return null;
    const t = new Date(refreshedAt).getTime();
    if (Number.isNaN(t) || t <= 0) return null;
    return new Date(refreshedAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [refreshedAt]);

  return (
    <div className={styles.wrap}>
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <ThemeIcon size="md" variant="subtle" color="green" radius="md">
            <IconBroadcast size={18} />
          </ThemeIcon>
          <Text fw={600} size="md" c="#E5E7EB" style={{ letterSpacing: '-0.02em' }}>
            Ao vivo
          </Text>
        </div>
        {timeLine && (
          <Text size="xs" c="dimmed" className={styles.meta}>
            Atualizado {timeLine}
            {items.length > 0 ? ` · ${items.length} jogo${items.length > 1 ? 's' : ''}` : ''}
          </Text>
        )}
      </div>
      {error && (
        <Alert color="red" variant="light" radius="md" p="sm" title="Falha ao carregar" mb="sm">
          {error}
        </Alert>
      )}

      {loading && !error ? (
        <Group justify="center" py="md">
          <Loader size="sm" color="green" />
        </Group>
      ) : !error && items.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="sm">
          Nenhum jogo ao vivo.
        </Text>
      ) : !error && items.length > 0 ? (
        <div className={styles.grid}>
          {items.map((m) => {
            const isPaused = m.status?.toUpperCase() === 'PAUSED';
            const isLive = m.status?.toUpperCase() === 'IN_PLAY';
            return (
              <button
                key={m.id}
                type="button"
                className={`${styles.card} ${isPaused ? styles.cardPaused : ''}`}
                onClick={onMatchClick ? () => onMatchClick(m.id) : undefined}
                style={onMatchClick ? undefined : { cursor: 'default' }}
              >
                <Group justify="space-between" mb={8} wrap="nowrap" gap="xs">
                  {isLive ? (
                    <Badge size="sm" color="red" variant="filled" style={{ textTransform: 'none', fontWeight: 700 }}>
                      AO VIVO
                    </Badge>
                  ) : (
                    <Badge size="sm" color="yellow" variant="light" style={{ textTransform: 'none' }}>
                      Pausa
                    </Badge>
                  )}
                  {m.minute != null && isLive && (
                    <Text size="xs" fw={700} c="gray.3" className="tabular-nums">
                      {m.minute}&apos;
                    </Text>
                  )}
                </Group>
                <Group justify="space-between" align="center" wrap="nowrap" gap={8} grow>
                  <Text className={styles.team} style={{ textAlign: 'right', flex: 1 }}>
                    {m.homeTeam}
                  </Text>
                  <div className={styles.centerCol}>
                    <span className={styles.score}>
                      {m.homeScore} <span style={{ color: '#6b7280', fontWeight: 600 }}>×</span> {m.awayScore}
                    </span>
                  </div>
                  <Text className={styles.team} style={{ textAlign: 'left', flex: 1 }}>
                    {m.awayTeam}
                  </Text>
                </Group>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export const LiveMatchesSection = memo(LiveMatchesSectionInner);
