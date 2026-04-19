import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Title, Text, SimpleGrid, Loader, Alert, Tabs, Group, Button, Paper, ThemeIcon } from '@mantine/core';
import {
  IconCalendarEvent,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconChartDots,
} from '@tabler/icons-react';
import { getResultsOfDay, getTopLeaguesMatches, getMatchDetail, getGenerationInfo } from '../api/football';
import { useAuth } from '../contexts/AuthContext';
import { ResultCard } from '../components/ResultCard';
import { MatchDetailModal } from '../components/MatchDetailModal';
import type { MatchResult, MatchDetail, GenerationInfo } from '../types';
import type { PlanType } from '../types';

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** Soma ou subtrai dias em uma data YYYY-MM-DD */
function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Formata data para exibição em pt-BR (ex: "6 de março de 2026") */
function formatDateLabel(dateStr: string): string {
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

/** Retorna se a data é hoje */
function isToday(dateStr: string): boolean {
  return dateStr === todayISO();
}

function formatDateTimePt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Plano grátis: só pode buscar dia anterior e dia seguinte (não passa disso) */
function isFreePlan(plan: PlanType | null, isLoggedIn: boolean): boolean {
  return !isLoggedIn || plan === 'FREE' || plan === null;
}

export function Home() {
  const { isLoggedIn, plan } = useAuth();
  const [date, setDate] = useState(todayISO);

  const freePlan = isFreePlan(plan ?? null, isLoggedIn);
  const yesterday = addDays(todayISO(), -1);
  const tomorrow = addDays(todayISO(), 1);
  const canGoPrev = !freePlan || date > yesterday;
  const canGoNext = !freePlan || date < tomorrow;

  const [results, setResults] = useState<MatchResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const [highlights, setHighlights] = useState<MatchResult[]>([]);
  const [highlightsLoading, setHighlightsLoading] = useState(true);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);

  const [detailMatch, setDetailMatch] = useState<MatchDetail | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [genInfo, setGenInfo] = useState<GenerationInfo | null>(null);
  const [genInfoError, setGenInfoError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGenerationInfo()
      .then((data) => {
        if (!cancelled) setGenInfo(data);
      })
      .catch(() => {
        if (!cancelled) setGenInfoError(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setResultsLoading(true);
    setResultsError(null);
    getResultsOfDay(date)
      .then((data) => {
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setResultsError(e.message || 'Erro ao carregar resultados.');
      })
      .finally(() => {
        if (!cancelled) setResultsLoading(false);
      });
    return () => { cancelled = true; };
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    setHighlightsLoading(true);
    setHighlightsError(null);
    getTopLeaguesMatches(date)
      .then((data) => {
        if (!cancelled) setHighlights(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setHighlightsError(e.message || 'Erro ao carregar destaques.');
      })
      .finally(() => {
        if (!cancelled) setHighlightsLoading(false);
      });
    return () => { cancelled = true; };
  }, [date]);

  const openMatchDetail = (matchId: number) => {
    getMatchDetail(matchId).then((m) => {
      if (m) {
        setDetailMatch(m);
        setDetailModalOpen(true);
      }
    });
  };

  // Plano grátis: manter data só entre dia anterior e dia seguinte
  useEffect(() => {
    if (!freePlan) return;
    const y = addDays(todayISO(), -1);
    const t = addDays(todayISO(), 1);
    if (date < y) setDate(y);
    else if (date > t) setDate(t);
  }, [freePlan, date]);

  return (
    <div style={{ padding: '1.5rem' }}>
      <Title order={1} mb="xs">SmartGol</Title>

      {genInfoError && (
        <Alert color="orange" variant="light" mb="md" title="Geração automática">
          Não foi possível contactar a API para o estado da última geração. Confirme se o backend está ligado.
        </Alert>
      )}

      {genInfo && !genInfoError && (
        <Paper withBorder p="md" radius="md" mb="lg">
          <Group gap="md" align="flex-start" wrap="nowrap">
            <ThemeIcon size="lg" variant="light" color="teal" radius="md">
              <IconClock size={22} />
            </ThemeIcon>
            <div>
              <Text fw={600} size="sm" mb={4}>
                Prognósticos automáticos
              </Text>
              <Text size="sm" c="dimmed" mb="xs">
                {genInfo.scheduleDescription}
                {' · '}
                Plano grátis: 5 palpites com análise completa (melhores do dia); lista completa em Prognósticos. Assinantes veem todos.
              </Text>
              {genInfo.lastAt ? (
                <Text size="sm">
                  Última geração registada:{' '}
                  <Text span fw={500} c="teal.4">
                    {formatDateTimePt(genInfo.lastAt)}
                  </Text>
                  {genInfo.lastCount != null && (
                    <Text span c="dimmed" size="sm">
                      {' '}
                      ({genInfo.lastCount} palpite{genInfo.lastCount === 1 ? '' : 's'})
                    </Text>
                  )}
                </Text>
              ) : (
                <Text size="sm" c="dimmed">
                  Ainda não há registo de geração neste servidor (corre ao gerar pela API ou no horário agendado).
                </Text>
              )}
            </div>
          </Group>
        </Paper>
      )}

      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm" mb="lg">
        <div>
          <Text c="dimmed" size="sm">
            {formatDateLabel(date)}
            {isLoggedIn && plan && ` · Plano: ${plan}`}
          </Text>
          {freePlan && (
            <Text size="xs" c="dimmed">Grátis: apenas dia anterior, hoje e dia seguinte.</Text>
          )}
        </div>
        <Group gap="xs">
          <Button
            variant="light"
            size="xs"
            leftSection={<IconChevronLeft size={16} />}
            disabled={!canGoPrev}
            onClick={() => {
              const next = addDays(date, -1);
              if (freePlan && next < yesterday) return;
              setDate(next);
            }}
          >
            Dia anterior
          </Button>
          {!isToday(date) && (
            <Button
              variant="subtle"
              size="xs"
              onClick={() => setDate(todayISO())}
            >
              Hoje
            </Button>
          )}
          <Button
            variant="light"
            size="xs"
            rightSection={<IconChevronRight size={16} />}
            disabled={!canGoNext}
            onClick={() => {
              const next = addDays(date, 1);
              if (freePlan && next > tomorrow) return;
              setDate(next);
            }}
          >
            Próximo dia
          </Button>
        </Group>
      </Group>

      <Tabs defaultValue="jogos">
        <Tabs.List mb="lg">
          <Tabs.Tab value="jogos" leftSection={<IconCalendarEvent size={16} />}>
            Jogos
          </Tabs.Tab>
          <Tabs.Tab value="resultados" leftSection={<IconChartBar size={16} />}>
            Resultados
          </Tabs.Tab>
          <Tabs.Tab value="palpites" leftSection={<IconChartDots size={16} />}>
            Palpites
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="jogos">
          <Text size="sm" c="dimmed" mb="md">
            Partidas reais do calendário (principais ligas) para a data selecionada. Os palpites ficam no separador{' '}
            <Text span fw={600}>Palpites</Text> ou em{' '}
            <Link to="/prognosticos" style={{ color: 'var(--mantine-color-green-4)' }}>
              Palpites (lista completa)
            </Link>
            .
          </Text>
          {highlightsError && (
            <Alert color="red" mb="md">{highlightsError}</Alert>
          )}
          {highlightsLoading ? (
            <Loader size="lg" />
          ) : highlights.length === 0 ? (
            <Text c="dimmed">Nenhum jogo das principais ligas nesta data (ou a API externa não devolveu dados).</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {highlights.map((r) => (
                <ResultCard
                  key={r.id}
                  match={r}
                  onClick={() => openMatchDetail(r.id)}
                />
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="resultados">
          {resultsError && (
            <Alert color="red" mb="md">{resultsError}</Alert>
          )}
          {resultsLoading ? (
            <Loader size="lg" />
          ) : results.length === 0 ? (
            <Text c="dimmed">Nenhum resultado disponível para esta data.</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {results.map((r) => (
                <ResultCard
                  key={r.id}
                  match={r}
                  onClick={() => openMatchDetail(r.id)}
                />
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="palpites">
          <Text size="sm" c="dimmed" mb="md">
            Os palpites do dia (grátis e por plano) estão na página{' '}
            <Link to="/prognosticos" style={{ color: 'var(--mantine-color-green-4)' }}>
              Prognósticos
            </Link>
            , com a lista completa e navegação por data.
          </Text>
          <Button component={Link} to="/prognosticos" variant="light">
            Abrir Prognósticos
          </Button>
        </Tabs.Panel>
      </Tabs>

      <MatchDetailModal
        match={detailMatch}
        opened={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
      />
    </div>
  );
}
