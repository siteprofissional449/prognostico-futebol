import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Title,
  Text,
  SimpleGrid,
  Loader,
  Alert,
  Group,
  Button,
  Stack,
  Paper,
  TextInput,
} from '@mantine/core';
import { getPredictionsHistory } from '../api/predictions';
import { useAuth } from '../contexts/AuthContext';
import { canSeeHistory } from '../utils/planAccess';
import { PredictionHistoryCard } from '../components/PredictionHistoryCard';
import type { PredictionView, PredictionsHistoryResponse } from '../types';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(dateStr: string) {
  try {
    return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function collectItems(data: PredictionsHistoryResponse | null): PredictionView[] {
  if (!data?.days?.length) return [];
  return data.days.flatMap((d) => d.items || []);
}

export function HistoricoAcertos() {
  const { isLoggedIn, plan } = useAuth();
  const allowed = isLoggedIn && canSeeHistory(plan);

  const [from, setFrom] = useState(() => addDays(todayISO(), -14));
  const [to, setTo] = useState(todayISO);
  const [data, setData] = useState<PredictionsHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    getPredictionsHistory(from, to)
      .then(setData)
      .catch((e) => setError(e?.message || 'Não foi possível carregar o histórico.'))
      .finally(() => setLoading(false));
  }, [allowed, from, to]);

  useEffect(() => {
    if (!allowed) {
      setData(null);
      setError(null);
      return;
    }
    void load();
  }, [allowed, load]);

  const stats = useMemo(() => {
    const items = collectItems(data);
    let green = 0;
    let red = 0;
    let pending = 0;
    for (const p of items) {
      const s = p.resultStatus;
      if (s === 'GREEN') green++;
      else if (s === 'RED') red++;
      else pending++;
    }
    const decided = green + red;
    const hitRate = decided > 0 ? (green / decided) * 100 : null;
    return { items, green, red, pending, decided, hitRate, daysCount: data?.days?.length ?? 0 };
  }, [data]);

  if (!isLoggedIn) {
    return (
      <Stack p="md" maw={720} mx="auto" gap="md">
        <Title order={2}>Histórico de acertos</Title>
        <Alert color="blue">
          Faça <Link to="/login">login</Link> para ver esta área.
        </Alert>
      </Stack>
    );
  }

  if (!allowed) {
    return (
      <Stack p="md" maw={720} mx="auto" gap="md">
        <Title order={2}>Histórico de acertos</Title>
        <Text c="dimmed" size="sm">
          Disponível para assinantes <strong>Semanal</strong> ou <strong>Mensal</strong>: palpites de dias
          anteriores cruzados com placares reais (green / red / pendente) e taxa de acerto no período.
        </Text>
        <Button component={Link} to="/planos" variant="light" color="violet">
          Ver planos
        </Button>
      </Stack>
    );
  }

  return (
    <Stack p="md" maw={1200} mx="auto" gap="lg">
      <div>
        <Title order={2}>Histórico de acertos</Title>
        <Text c="dimmed" size="sm" maw={720}>
          Prognósticos de dias já passados, com resultado do jogo e se o palpite bateu (green/red).
          Período padrão na API também limita a dados anteriores a hoje.
        </Text>
      </div>

      <Paper p="md" withBorder>
        <Group align="flex-end" wrap="wrap" gap="md">
          <TextInput
            label="De (YYYY-MM-DD)"
            value={from}
            onChange={(e) => setFrom(e.currentTarget.value)}
            w={160}
          />
          <TextInput
            label="Até (YYYY-MM-DD)"
            value={to}
            onChange={(e) => setTo(e.currentTarget.value)}
            w={160}
          />
          <Button onClick={load} loading={loading}>
            Atualizar
          </Button>
        </Group>
      </Paper>

      {error && <Alert color="red">{error}</Alert>}

      {loading && !data ? (
        <Loader />
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">Dias com dados</Text>
              <Text fw={700} size="xl">{stats.daysCount}</Text>
            </Paper>
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">Palpites (período)</Text>
              <Text fw={700} size="xl">{stats.items.length}</Text>
            </Paper>
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">Green / Red</Text>
              <Text fw={700} size="xl">
                {stats.green} / {stats.red}
              </Text>
              <Text size="xs" c="dimmed">Pendentes: {stats.pending}</Text>
            </Paper>
            <Paper p="md" withBorder>
              <Text size="xs" c="dimmed" tt="uppercase">Taxa (greens / decididos)</Text>
              <Text fw={700} size="xl" c="green.4">
                {stats.hitRate != null ? `${stats.hitRate.toFixed(1)}%` : '—'}
              </Text>
              <Text size="xs" c="dimmed">
                {stats.decided > 0
                  ? `Base: ${stats.decided} jogo(s) com resultado`
                  : 'Sem jogos finalizados no período'}
              </Text>
            </Paper>
          </SimpleGrid>

          {!data?.days?.length ? (
            <Text c="dimmed">Nenhum dia anterior com prognósticos neste intervalo.</Text>
          ) : (
            <Stack gap="xl">
              {data.days.map((day) => (
                <div key={day.date}>
                  <Title order={4} mb="md">
                    {formatDateLabel(day.date)}
                  </Title>
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                    {(day.items || []).map((p) => (
                      <PredictionHistoryCard key={p.id} p={p} />
                    ))}
                  </SimpleGrid>
                </div>
              ))}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
