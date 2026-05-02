import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Text,
  SimpleGrid,
  Alert,
  Tabs,
  Group,
  Button,
  UnstyledButton,
  Skeleton,
} from '@mantine/core';
import {
  IconCalendarEvent,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconChartDots,
} from '@tabler/icons-react';
import { getHomePredictions } from '../api/predictions';
import { getPublicManualPrognostics } from '../api/premium';
import { getResultsOfDay, getTopLeaguesMatches, getMatchDetail, getGenerationInfo } from '../api/football';
import { LiveMatchesSection } from '../components/LiveMatchesSection';
import { useAuth } from '../contexts/AuthContext';
import { GameCard } from '../components/GameCard';
import { ResultCard } from '../components/ResultCard';
import { MatchDetailModal } from '../components/MatchDetailModal';
import type {
  PredictionView,
  MatchResult,
  MatchDetail,
  GenerationInfo,
  AdminPrognostic,
} from '../types';
import type { PlanType } from '../types';
import styles from './Home.module.css';
import {
  todayYMDInAppTimezone as todayISO,
  addCalendarDaysYMD as addDays,
} from '../utils/appDate';
import { slugifyTeam, predictionDateYMD } from '../utils/matchSlug';

function destaqueMatchKey(p: PredictionView): string {
  const ymd = p.predictionDate?.slice(0, 10) || predictionDateYMD(p);
  return `${slugifyTeam(p.homeTeam)}|${slugifyTeam(p.awayTeam)}|${ymd}`;
}

/** Formato compatível com GameCard; `id` prefixado para detetar link para /prognosticos. */
function adminPrognosticToTeaserView(m: AdminPrognostic): PredictionView {
  const ymd = m.matchDate.slice(0, 10);
  return {
    id: `manual-${m.id}`,
    matchId: `manual-${m.id}`,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    league: 'Palpite manual',
    startTime: m.matchDate,
    predictionDate: ymd,
    minPlan: m.plan,
    market: m.prediction,
    probability: m.probability ?? null,
    odd: m.odd,
    probHome: null,
    probDraw: null,
    probAway: null,
    bestBet: null,
    analysis: null,
    isPremium: false,
    locked: false,
  };
}

function formatDateLabel(dateStr: string): string {
  try {
    return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return dateStr;
  }
}

function isToday(dateStr: string) {
  return dateStr === todayISO();
}

function formatTimeShort(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function isFreePlan(plan: PlanType | null, isLoggedIn: boolean) {
  return !isLoggedIn || plan === 'FREE' || plan === null;
}

function LoadingGrid({ cards = 3 }: { cards?: number }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {Array.from({ length: cards }).map((_, idx) => (
        <div key={`skeleton-${idx}`} className={styles.block}>
          <Skeleton height={14} width="40%" mb={12} />
          <Skeleton height={26} width="52%" mb={14} />
          <Skeleton height={44} radius="md" mb={10} />
          <Skeleton height={12} width="70%" />
        </div>
      ))}
    </SimpleGrid>
  );
}

export function Home() {
  const { isLoggedIn, plan } = useAuth();
  const [date, setDate] = useState(todayISO);
  const freePlan = isFreePlan(plan ?? null, isLoggedIn);
  const yesterday = addDays(todayISO(), -1);
  const tomorrow = addDays(todayISO(), 1);
  const canGoPrev = !freePlan || date > yesterday;
  const canGoNext = !freePlan || date < tomorrow;

  const [predictionsCur, setPredictionsCur] = useState<PredictionView[]>([]);
  const [predictionsLoading, setPredictionsLoading] = useState(true);
  const [predictionsError, setPredictionsError] = useState<string | null>(null);
  const [manualTeasers, setManualTeasers] = useState<AdminPrognostic[]>([]);
  const [manualLoading, setManualLoading] = useState(true);
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

  const dateLabel = useMemo(() => formatDateLabel(date), [date]);

  useEffect(() => {
    let cancelled = false;
    getGenerationInfo()
      .then((d) => {
        if (!cancelled) setGenInfo(d);
      })
      .catch(() => {
        if (!cancelled) setGenInfoError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const fetchPredictions = useCallback(() => {
    return getHomePredictions(date).then((r) => {
      const cur = r.items || [];
      setPredictionsCur(Array.isArray(cur) ? cur : []);
    });
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    setPredictionsLoading(true);
    setPredictionsError(null);
    fetchPredictions()
      .catch((e) => {
        if (!cancelled) setPredictionsError(e.message || 'Erro ao carregar.');
      })
      .finally(() => {
        if (!cancelled) setPredictionsLoading(false);
      });
    return () => { cancelled = true; };
  }, [date, fetchPredictions]);

  useEffect(() => {
    let cancelled = false;
    setManualLoading(true);
    getPublicManualPrognostics({ from: date, to: date })
      .then((rows) => {
        if (!cancelled) setManualTeasers(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setManualTeasers([]);
      })
      .finally(() => {
        if (!cancelled) setManualLoading(false);
      });
    return () => { cancelled = true; };
  }, [date]);

  useEffect(() => {
    let cancelled = false;
    setResultsLoading(true);
    setResultsError(null);
    getResultsOfDay(date)
      .then((data) => {
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) setResultsError(e.message || 'Erro.');
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
        if (!cancelled) setHighlightsError(e.message || 'Erro.');
      })
      .finally(() => {
        if (!cancelled) setHighlightsLoading(false);
      });
    return () => { cancelled = true; };
  }, [date]);

  const openMatchDetail = useCallback((matchId: number) => {
    getMatchDetail(matchId).then((m) => {
      if (m) {
        setDetailMatch(m);
        setDetailModalOpen(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!freePlan) return;
    const y = addDays(todayISO(), -1);
    const t = addDays(todayISO(), 1);
    if (date < y) setDate(y);
    else if (date > t) setDate(t);
  }, [freePlan, date]);

  const destaqueDiaItems = useMemo(() => {
    const manualViews = manualTeasers.map(adminPrognosticToTeaserView);
    const manualKeys = new Set(manualViews.map(destaqueMatchKey));
    const autoSemDuplicar = predictionsCur.filter((p) => !manualKeys.has(destaqueMatchKey(p)));
    return [...manualViews, ...autoSemDuplicar].slice(0, 3);
  }, [manualTeasers, predictionsCur]);

  const destaqueDiaLoading = predictionsLoading || manualLoading;

  return (
    <div className={styles.page}>
      <div className={styles.subBar}>
        <h1 className={styles.title}>SmartGol</h1>
        {isLoggedIn && plan && (
          <Text size="xs" c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {plan}
          </Text>
        )}
      </div>

      {genInfoError && (
        <Alert color="red" variant="light" p="sm" radius="md" mb="sm" title="API">
          Sem ligação ao servidor.
        </Alert>
      )}

      {genInfo && !genInfoError && (genInfo.lastAt || genInfo.lastCount != null) && (
        <div className={styles.metaStrip}>
          {genInfo.lastAt && (
            <Text component="span" size="sm" c="dimmed">
              Última geração{' '}
              <strong className="tabular-nums" style={{ color: '#E5E7EB' }}>
                {formatTimeShort(genInfo.lastAt)}
              </strong>
            </Text>
          )}
          {genInfo.lastCount != null && (
            <Text component="span" size="sm" c="dimmed">
              {genInfo.lastCount} {genInfo.lastCount === 1 ? 'análise' : 'análises'}
            </Text>
          )}
        </div>
      )}

      <LiveMatchesSection onMatchClick={openMatchDetail} />

      <div className={styles.dateNav}>
        <Text size="sm" c="dimmed" fw={500}>
          {dateLabel}
        </Text>
        <Group gap={4} wrap="nowrap">
          <Button
            variant="default"
            size="compact-sm"
            color="gray"
            leftSection={<IconChevronLeft size={14} />}
            disabled={!canGoPrev}
            onClick={() => {
              const next = addDays(date, -1);
              if (freePlan && next < yesterday) return;
              setDate(next);
            }}
          />
          {!isToday(date) && (
            <UnstyledButton
              c="var(--app-accent, #22c55e)"
              fz="xs"
              component="span"
              onClick={() => setDate(todayISO())}
            >
              Hoje
            </UnstyledButton>
          )}
          <Button
            variant="default"
            size="compact-sm"
            color="gray"
            rightSection={<IconChevronRight size={14} />}
            disabled={!canGoNext}
            onClick={() => {
              const next = addDays(date, 1);
              if (freePlan && next > tomorrow) return;
              setDate(next);
            }}
          />
        </Group>
      </div>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <div>
            <p className={styles.sectionTitle}>Prognósticos</p>
            <h2 className={styles.blockTitle}>Destaques do dia</h2>
          </div>
          <UnstyledButton component={Link} to="/prognosticos" c="var(--app-accent, #22c55e)" fz="sm" fw={600}>
            Ver tudo
          </UnstyledButton>
        </div>
        {predictionsError && <Alert color="red" p="sm" radius="md" mb="sm">{predictionsError}</Alert>}
        {destaqueDiaLoading ? (
          <LoadingGrid />
        ) : destaqueDiaItems.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="md">Sem palpites para esta data.</Text>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {destaqueDiaItems.map((p) =>
              p.id.startsWith('manual-') ? (
                <Link
                  key={p.id}
                  to="/prognosticos"
                  style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                >
                  <GameCard p={p} disableSeoLink />
                </Link>
              ) : (
                <GameCard key={p.id} p={p} />
              ),
            )}
          </SimpleGrid>
        )}
      </section>

      <Tabs
        defaultValue="jogos"
        classNames={{ list: `${styles.tabsList} ${styles.tabsListResponsive}` }}
      >
        <Tabs.List>
          <Tabs.Tab
            value="jogos"
            aria-label="Jogos (calendário do dia)"
            title="Jogos"
            leftSection={<IconCalendarEvent size={16} className={styles.tabsTabIcon} />}
          >
            <span className={styles.tabsTabLabel}>Jogos</span>
          </Tabs.Tab>
          <Tabs.Tab
            value="resultados"
            aria-label="Resultados do dia"
            title="Resultados"
            leftSection={<IconChartBar size={16} className={styles.tabsTabIcon} />}
          >
            <span className={styles.tabsTabLabel}>Resultados</span>
          </Tabs.Tab>
          <Tabs.Tab
            value="palpites"
            aria-label="Palpites do dia na lista"
            title="Palpites"
            leftSection={<IconChartDots size={16} className={styles.tabsTabIcon} />}
          >
            <span className={styles.tabsTabLabel}>Palpites</span>
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="jogos" pt="md">
          {highlightsError && <Alert color="red" p="sm" mb="sm" radius="md">{highlightsError}</Alert>}
          {highlightsLoading ? (
            <LoadingGrid cards={6} />
          ) : highlights.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">Sem calendário para esta data.</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {highlights.map((r) => (
                <ResultCard key={r.id} match={r} onClick={() => openMatchDetail(r.id)} />
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="resultados" pt="md">
          {resultsError && <Alert color="red" p="sm" mb="sm" radius="md">{resultsError}</Alert>}
          {resultsLoading ? (
            <LoadingGrid cards={6} />
          ) : results.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">Sem resultados.</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {results.map((r) => (
                <ResultCard key={r.id} match={r} onClick={() => openMatchDetail(r.id)} />
              ))}
            </SimpleGrid>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="palpites" pt="md">
          {predictionsError && <Alert color="red" p="sm" mb="sm" radius="md">{predictionsError}</Alert>}
          {predictionsLoading ? (
            <LoadingGrid cards={6} />
          ) : predictionsCur.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">Sem palpites.</Text>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
              {predictionsCur.map((p) => (
                <GameCard key={p.id} p={p} />
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
