import { useState, useEffect } from 'react';
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
} from '@mantine/core';
import { Link } from 'react-router-dom';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { getMyPredictionsList, getPublicPredictionsList } from '../api/predictions';
import { getPublicManualPrognostics } from '../api/premium';
import { useAuth } from '../contexts/AuthContext';
import { GameCard } from '../components/GameCard';
import { PremiumLockCard } from '../components/PremiumLockCard';
import { PremiumPrognosticCard } from '../components/PremiumPrognosticCard';
import type { AdminPrognostic, PredictionView } from '../types';

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
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function isPaidPlan(plan: string | null | undefined): boolean {
  return (
    plan === 'DAILY' ||
    plan === 'WEEKLY' ||
    plan === 'MONTHLY' ||
    plan === 'PREMIUM'
  );
}

export function Prognosticos() {
  const { isLoggedIn, plan } = useAuth();
  const [date, setDate] = useState(todayISO);
  const [items, setItems] = useState<PredictionView[]>([]);
  const [meta, setMeta] = useState<{
    total: number;
    freeSlotCount: number;
    effectiveDate: string;
    requestedDate: string;
    userAccessTier: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState<AdminPrognostic[]>([]);
  const [manualLoading, setManualLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setManualLoading(true);
    getPublicManualPrognostics({ from: date, to: date })
      .then((rows) => {
        if (!cancelled) setManual(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setManual([]);
      })
      .finally(() => {
        if (!cancelled) setManualLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const req = isLoggedIn ? getMyPredictionsList(date) : getPublicPredictionsList(date);
    req
      .then((r) => {
        if (!cancelled) {
          setItems(r.items);
          setMeta({
            total: r.meta.total,
            freeSlotCount: r.meta.freeSlotCount,
            effectiveDate: r.meta.effectiveDate,
            requestedDate: r.meta.requestedDate,
            userAccessTier: r.meta.userAccessTier,
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'Erro ao carregar.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, isLoggedIn]);

  const paid = isLoggedIn && isPaidPlan(plan);

  return (
    <Stack p="md" maw={1200} mx="auto" gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={2}>Prognósticos</Title>
          <Text c="dimmed" size="sm">
            Palpites automáticos: no grátis são até {meta?.freeSlotCount ?? 5} com análise completa; o restante do dia pode ficar bloqueado. Abaixo, quando existirem, aparecem os{' '}
            <Text span fw={600}>palpites manuais grátis</Text> da equipa (só para todos os visitantes).
          </Text>
        </div>
        <Button component={Link} to="/planos" variant="light" color="violet">
          Ver planos
        </Button>
      </Group>

      <Group>
        <Button
          variant="default"
          leftSection={<IconChevronLeft size={16} />}
          disabled={(meta?.userAccessTier ?? 0) < 2}
          onClick={() => setDate(addDays(date, -1))}
        >
          Dia anterior
        </Button>
        <Text fw={600}>{formatDateLabel(date)}</Text>
        <Button
          variant="default"
          rightSection={<IconChevronRight size={16} />}
          disabled={(meta?.userAccessTier ?? 0) < 2}
          onClick={() => setDate(addDays(date, 1))}
        >
          Próximo dia
        </Button>
      </Group>

      {meta && meta.requestedDate !== meta.effectiveDate && (
        <Alert color="yellow">
          No seu plano atual, o acesso é apenas ao dia atual. Exibindo {formatDateLabel(meta.effectiveDate)}.
        </Alert>
      )}

      {paid && (
        <Paper p="sm" withBorder>
          <Text size="sm">
            Com o seu plano, você vê todos os {meta?.total ?? '—'} palpites deste dia, incluindo os
            marcados como premium na versão gratuita.
          </Text>
        </Paper>
      )}

      {!manualLoading && manual.length > 0 && (
        <Stack gap="sm">
          <Title order={4}>Palpites da equipa (grátis)</Title>
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            {manual.map((row) => (
              <PremiumPrognosticCard key={row.id} row={row} />
            ))}
          </SimpleGrid>
        </Stack>
      )}

      <Title order={4} mt={manual.length > 0 ? 'lg' : 0}>
        Palpites automáticos
      </Title>

      {error && <Alert color="red">{error}</Alert>}
      {loading ? (
        <Loader />
      ) : items.length === 0 ? (
        <Text c="dimmed">Nenhum prognóstico automático para esta data.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {items.map((p) =>
            p.locked ? (
              <PremiumLockCard key={p.id} p={p} />
            ) : (
              <GameCard key={p.id} p={p} />
            ),
          )}
        </SimpleGrid>
      )}
    </Stack>
  );
}
