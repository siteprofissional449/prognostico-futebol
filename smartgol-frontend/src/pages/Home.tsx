import { useState, useEffect } from 'react';
import { Title, Text, SimpleGrid, Loader, Alert, Tabs, Group, Button, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCalendarEvent, IconTrophy, IconChartBar, IconChevronLeft, IconChevronRight, IconCloudDownload } from '@tabler/icons-react';
import { getPublicPredictions, getMyPredictions } from '../api/predictions';
import { getResultsOfDay, getTopLeaguesMatches, getMatchDetail, generatePredictionsForDate } from '../api/football';
import { useAuth } from '../contexts/AuthContext';
import { GameCard } from '../components/GameCard';
import { ResultCard } from '../components/ResultCard';
import { MatchDetailModal } from '../components/MatchDetailModal';
import type { Prediction, MatchResult, MatchDetail } from '../types';
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

/** Plano grátis: só pode buscar dia anterior e dia seguinte (não passa disso) */
function isFreePlan(plan: PlanType | null, isLoggedIn: boolean): boolean {
  return !isLoggedIn || plan === 'FREE';
}

export function Home() {
  const { isLoggedIn, plan } = useAuth();
  const [date, setDate] = useState(todayISO);

  const freePlan = isFreePlan(plan ?? null, isLoggedIn);
  const yesterday = addDays(todayISO(), -1);
  const tomorrow = addDays(todayISO(), 1);
  const canGoPrev = !freePlan || date > yesterday;
  const canGoNext = !freePlan || date < tomorrow;

  /** Jogos: dia anterior, dia atual, próximo dia */
  const [predictionsPrev, setPredictionsPrev] = useState<Prediction[]>([]);
  const [predictionsCur, setPredictionsCur] = useState<Prediction[]>([]);
  const [predictionsNext, setPredictionsNext] = useState<Prediction[]>([]);
  const [predictionsLoading, setPredictionsLoading] = useState(true);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);

  const [results, setResults] = useState<MatchResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const [highlights, setHighlights] = useState<MatchResult[]>([]);
  const [highlightsLoading, setHighlightsLoading] = useState(true);
  const [highlightsError, setHighlightsError] = useState<string | null>(null);

  const [detailMatch, setDetailMatch] = useState<MatchDetail | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [generatingNextDay, setGeneratingNextDay] = useState(false);

  const fetchPredictions = () => {
    const fetchPlan: PlanType = plan || 'FREE';
    const datePrev = addDays(date, -1);
    const dateNext = addDays(date, 1);
    const fetcher = (d: string) =>
      isLoggedIn ? getMyPredictions(d) : getPublicPredictions(fetchPlan, d);
    return Promise.all([
      fetcher(datePrev),
      fetcher(date),
      fetcher(dateNext),
    ]).then(([prev, cur, next]) => {
      setPredictionsPrev(Array.isArray(prev) ? prev : []);
      setPredictionsCur(Array.isArray(cur) ? cur : []);
      setPredictionsNext(Array.isArray(next) ? next : []);
    });
  };

  useEffect(() => {
    let cancelled = false;
    setPredictionsLoading(true);
    setPredictionsError(null);
    fetchPredictions()
      .catch((e) => {
        if (!cancelled) setPredictionsError(e.message || 'Erro ao carregar jogos.');
      })
      .finally(() => {
        if (!cancelled) setPredictionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [isLoggedIn, plan, date]);

  const handleBuscarDiaSeguinteNaApi = () => {
    const dateNext = addDays(date, 1);
    setGeneratingNextDay(true);
    generatePredictionsForDate(dateNext)
      .then(({ count }) => {
        notifications.show({
          color: 'green',
          message: `${count} jogo(s) do dia seguinte carregado(s) na API.`,
        });
        return fetchPredictions();
      })
      .catch((e) => {
        notifications.show({
          color: 'red',
          message: e?.message || 'Erro ao buscar jogos do dia seguinte na API.',
        });
      })
      .finally(() => setGeneratingNextDay(false));
  };

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
            Jogos do dia
          </Tabs.Tab>
          <Tabs.Tab value="resultados" leftSection={<IconChartBar size={16} />}>
            Resultados do dia
          </Tabs.Tab>
          <Tabs.Tab value="destaques" leftSection={<IconTrophy size={16} />}>
            Melhores jogos do mundo
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="jogos">
          {predictionsError && (
            <Alert color="red" mb="md">{predictionsError}</Alert>
          )}
          {predictionsLoading ? (
            <Loader size="lg" />
          ) : (
            <Stack gap="xl">
              <div>
                <Title order={4} mb="xs" c="dimmed">Dia anterior — {formatDateLabel(addDays(date, -1))}</Title>
                {predictionsPrev.length === 0 ? (
                  <Text size="sm" c="dimmed">Nenhum jogo.</Text>
                ) : (
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                    {predictionsPrev.map((p) => (
                      <GameCard key={p.id} p={p} />
                    ))}
                  </SimpleGrid>
                )}
              </div>
              <div>
                <Title order={4} mb="xs">Hoje — {formatDateLabel(date)}</Title>
                {predictionsCur.length === 0 ? (
                  <Text size="sm" c="dimmed">Nenhum jogo. Gere os prognósticos no backend (POST /football/generate-today).</Text>
                ) : (
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                    {predictionsCur.map((p) => (
                      <GameCard key={p.id} p={p} />
                    ))}
                  </SimpleGrid>
                )}
              </div>
              <div>
                <Group justify="space-between" align="flex-end" mb="xs" wrap="wrap" gap="xs">
                  <div>
                    <Title order={4} c="dimmed">Dia seguinte — {formatDateLabel(addDays(date, 1))}</Title>
                    <Text size="xs" c="dimmed">Busca dos jogos do dia seguinte na API.</Text>
                  </div>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconCloudDownload size={16} />}
                    loading={generatingNextDay}
                    onClick={handleBuscarDiaSeguinteNaApi}
                  >
                    Buscar jogos do dia seguinte na API
                  </Button>
                </Group>
                {predictionsNext.length === 0 ? (
                  <Text size="sm" c="dimmed">Nenhum jogo. Clique em "Buscar jogos do dia seguinte na API" para carregar.</Text>
                ) : (
                  <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                    {predictionsNext.map((p) => (
                      <GameCard key={p.id} p={p} />
                    ))}
                  </SimpleGrid>
                )}
              </div>
            </Stack>
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

        <Tabs.Panel value="destaques">
          {highlightsError && (
            <Alert color="red" mb="md">{highlightsError}</Alert>
          )}
          {highlightsLoading ? (
            <Loader size="lg" />
          ) : highlights.length === 0 ? (
            <Text c="dimmed">Nenhum jogo das principais ligas nesta data.</Text>
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
      </Tabs>

      <MatchDetailModal
        match={detailMatch}
        opened={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
      />
    </div>
  );
}
