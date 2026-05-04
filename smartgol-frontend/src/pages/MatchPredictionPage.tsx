/**
 * SPA / Vite: SEO via meta OG + canonical no cliente (equiv. parcial ao generateMetadata do Next.js).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Divider,
  Group,
  List,
  Loader,
  Paper,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import {
  getHomePredictions,
  getMyPredictionsList,
  getPublicPredictionsList,
} from '../api/predictions';
import { getMatchDetail, getMatchPrematchAnalysis } from '../api/football';
import type { MatchDetail, MatchPreMatchAnalysis, PredictionView, TeamTableRow } from '../types';
import { buildPalpiteSlug, parsePalpiteSlug, type ParsedSlug } from '../utils/matchSlug';
import { predictionMatchesSlug } from '../utils/predictionSlugMatch';
import { formatProb, marketLabel } from '../utils/predictionLabels';
import {
  generateFootballAnalysisParagraphs,
  generateH2HNarrativeParagraph,
} from '../utils/generateFootballAnalysisText';
import { usePredictionPageSeo } from '../hooks/usePredictionPageSeo';
import { useAuth } from '../contexts/AuthContext';
import { canAccessPaidPredictions } from '../utils/planAccess';
import { SeoTopicLinks } from '../components/SeoTopicLinks';
import styles from './MatchPredictionPage.module.css';

async function fetchPredictionAcrossSources(
  parsed: ParsedSlug,
  slugUrl: string,
  isLoggedIn: boolean,
): Promise<PredictionView | null> {
  const loaders = isLoggedIn
    ? [
        () => getMyPredictionsList(parsed.dateYMD),
        () => getPublicPredictionsList(parsed.dateYMD),
        () => getHomePredictions(parsed.dateYMD),
      ]
    : [() => getPublicPredictionsList(parsed.dateYMD), () => getHomePredictions(parsed.dateYMD)];

  for (const load of loaders) {
    try {
      const r = await load();
      const hit = r.items?.find((p) => predictionMatchesSlug(p, slugUrl, parsed));
      if (hit) return hit;
    } catch {
      /* seguinte fonte */
    }
  }
  return null;
}

function formatKickoff(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { dateStyle: 'short' });
  } catch {
    return iso;
  }
}

function tableRowLabel(t: TeamTableRow | null): string {
  if (!t || t.position == null) return '—';
  const pts = t.points != null ? `${t.points} pts` : '';
  const j = t.playedGames != null ? `${t.playedGames} jogos` : '';
  const mg =
    t.avgGoalsFor != null && t.avgGoalsAgainst != null ?
      ` · ${t.avgGoalsFor} golos/j marcados, ${t.avgGoalsAgainst} sofridos`
    : '';
  return `${t.position}º lugar (${[j, pts].filter(Boolean).join(', ')})${mg}`;
}

function splitVenueLabel(side: 'HOME' | 'AWAY', name: string, row: TeamTableRow | null) {
  if (!row || row.position == null) {
    return (
      <Text size="xs" c="dimmed">
        Sub-tabela {side === 'HOME' ? 'em casa' : 'fora'} indisponível (ex.: taça sem tabela ou API sem dados).
      </Text>
    );
  }
  const scope = side === 'HOME' ? 'como mandante' : 'como visitante';
  return (
    <Text size="xs" c="dimmed">
      {name} {scope}: {row.position}º · {row.playedGames ?? '—'} J · {row.points ?? '—'} pts ·
      golos {row.goalsFor ?? '—'}-{row.goalsAgainst ?? '—'}
      {row.avgGoalsFor != null && row.avgGoalsAgainst != null ?
        ` (~${row.avgGoalsFor} marcados / ~${row.avgGoalsAgainst} sofridos por jogo neste recorte)`
      : null}
      .
    </Text>
  );
}

function PreMatchDossierBlock({ data }: { data: MatchPreMatchAnalysis }) {
  const badge = (r: 'W' | 'D' | 'L') =>
    r === 'W' ?
      <Badge color="green" variant="light" size="sm">V</Badge>
    : r === 'L' ?
      <Badge color="red" variant="light" size="sm">D</Badge>
    : <Badge color="gray" variant="light" size="sm">E</Badge>;

  return (
    <Stack gap="md">
      <div>
        <Text size="xs" fw={700} className={styles.sectionTitle} tt="uppercase" mb={6}>
          Posição na tabela ({data.competition})
        </Text>
        <Stack gap="xs">
          <Paper p="sm" withBorder style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <Text size="sm" fw={700}>
              {data.home.name}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Geral: {tableRowLabel(data.home.table)}
            </Text>
          </Paper>
          <Paper p="sm" withBorder style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <Text size="sm" fw={700}>
              {data.away.name}
            </Text>
            <Text size="xs" c="dimmed" mt={4}>
              Geral: {tableRowLabel(data.away.table)}
            </Text>
          </Paper>
        </Stack>
      </div>

      <div>
        <Text size="xs" fw={700} className={styles.sectionTitle} tt="uppercase" mb={6}>
          Últimos 5 jogos (forma)
        </Text>
        <Stack gap="sm">
          <div>
            <Text size="xs" fw={600} mb={4}>
              {data.home.name}
            </Text>
            {data.home.formLast5.length === 0 ?
              <Text size="xs" c="dimmed">
                Sem histórico recente na resposta da API.
              </Text>
            : (
              <Stack gap={4}>
                {data.home.formLast5.map((f, i) => (
                  <Group key={`hf-${i}`} gap="xs" wrap="nowrap" align="flex-start">
                    {badge(f.result)}
                    <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                      {formatShortDate(f.utcDate)} · {f.isHome ? 'C' : 'F'} vs {f.opponent} ·{' '}
                      {f.teamScore}-{f.opponentScore} · {f.competition}
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}
          </div>
          <div>
            <Text size="xs" fw={600} mb={4}>
              {data.away.name}
            </Text>
            {data.away.formLast5.length === 0 ?
              <Text size="xs" c="dimmed">
                Sem histórico recente na resposta da API.
              </Text>
            : (
              <Stack gap={4}>
                {data.away.formLast5.map((f, i) => (
                  <Group key={`af-${i}`} gap="xs" wrap="nowrap" align="flex-start">
                    {badge(f.result)}
                    <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                      {formatShortDate(f.utcDate)} · {f.isHome ? 'C' : 'F'} vs {f.opponent} ·{' '}
                      {f.teamScore}-{f.opponentScore} · {f.competition}
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}
          </div>
        </Stack>
      </div>

      <div>
        <Text size="xs" fw={700} className={styles.sectionTitle} tt="uppercase" mb={6}>
          Desempenho casa / fora (liga)
        </Text>
        <Stack gap="xs">
          <div>
            <Text size="sm" fw={600}>
              {data.home.name}
            </Text>
            {splitVenueLabel('HOME', data.home.name, data.home.homeSplit)}
            {splitVenueLabel('AWAY', data.home.name, data.home.awaySplit)}
          </div>
          <div>
            <Text size="sm" fw={600}>
              {data.away.name}
            </Text>
            {splitVenueLabel('HOME', data.away.name, data.away.homeSplit)}
            {splitVenueLabel('AWAY', data.away.name, data.away.awaySplit)}
          </div>
        </Stack>
      </div>

      <div>
        <Text size="xs" fw={700} className={styles.sectionTitle} tt="uppercase" mb={6}>
          Escalações (quando a fonte as publica)
        </Text>
        <Stack gap="xs">
          <div>
            <Text size="xs" fw={600} mb={4}>
              {data.home.name}
            </Text>
            {!data.home.lineup || data.home.lineup.length === 0 ?
              <Text size="xs" c="dimmed">
                Ainda sem onze inicial nesta fonte — costuma aparecer perto do apito.
              </Text>
            : (
              <List size="xs" c="dimmed" spacing={4} center>
                {data.home.lineup.map((p, i) => (
                  <List.Item key={`hl-${i}`}>
                    {p.name}
                    {p.position ? ` · ${p.position}` : ''}
                    {p.shirtNumber != null ? ` · #${p.shirtNumber}` : ''}
                  </List.Item>
                ))}
              </List>
            )}
          </div>
          <div>
            <Text size="xs" fw={600} mb={4}>
              {data.away.name}
            </Text>
            {!data.away.lineup || data.away.lineup.length === 0 ?
              <Text size="xs" c="dimmed">
                Ainda sem onze inicial nesta fonte — costuma aparecer perto do apito.
              </Text>
            : (
              <List size="xs" c="dimmed" spacing={4} center>
                {data.away.lineup.map((p, i) => (
                  <List.Item key={`al-${i}`}>
                    {p.name}
                    {p.position ? ` · ${p.position}` : ''}
                    {p.shirtNumber != null ? ` · #${p.shirtNumber}` : ''}
                  </List.Item>
                ))}
              </List>
            )}
          </div>
        </Stack>
      </div>

      <div>
        <Text size="xs" fw={700} className={styles.sectionTitle} tt="uppercase" mb={6}>
          Desfalques (lesões / suspensões)
        </Text>
        <Stack gap={4}>
          {data.absences.map((a, i) => (
            <Text key={`ab-${i}`} size="xs" c="dimmed">
              <strong>{a.side === 'HOME' ? 'Mandante' : 'Visitante'}:</strong> {a.note}
            </Text>
          ))}
        </Stack>
      </div>

      <Text size="xs" c="dimmed" style={{ opacity: 0.85 }}>
        {data.dataSourceNote}
      </Text>
    </Stack>
  );
}

export function MatchPredictionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isLoggedIn, plan } = useAuth();
  const parsed = slug ? parsePalpiteSlug(slug) : null;

  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<PredictionView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [detailErr, setDetailErr] = useState(false);
  const [preMatch, setPreMatch] = useState<MatchPreMatchAnalysis | null>(null);
  const [preMatchLoading, setPreMatchLoading] = useState(false);
  const [preMatchErr, setPreMatchErr] = useState(false);

  const seoInput = useMemo(() => {
    if (!prediction) return null;
    const home = prediction.homeTeam.trim();
    const away = prediction.awayTeam.trim();
    const mLabel = marketLabel(prediction.market ?? null);
    const title = `Palpite ${home} x ${away} hoje — análise completa e previsão`;
    const description = `Palpite para ${home} x ${away} (${prediction.league}): mercado ${mLabel}, probabilidades e leitura tática — SmartGol.`;
    const keywords = `${home}, ${away}, palpite ${home}, prognóstico ${away}, odds, ${prediction.league ?? 'futebol'}, ${mLabel}`;
    return {
      title,
      description,
      canonicalPath: `/palpite/${buildPalpiteSlug(prediction)}`,
      keywords,
    };
  }, [prediction]);

  usePredictionPageSeo(!!prediction, seoInput);

  useEffect(() => {
    if (!slug || !parsed) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setPrediction(null);

    fetchPredictionAcrossSources(parsed, slug, isLoggedIn)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setNotFound(true);
          return;
        }
        setPrediction(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, parsed, isLoggedIn]);

  useEffect(() => {
    if (!prediction?.matchId) {
      setMatchDetail(null);
      return;
    }
    const id = Number.parseInt(prediction.matchId, 10);
    if (!Number.isFinite(id)) return;

    let cancelled = false;
    setDetailErr(false);
    getMatchDetail(id)
      .then((m) => {
        if (!cancelled) setMatchDetail(m);
      })
      .catch(() => {
        if (!cancelled) setDetailErr(true);
      });
    return () => {
      cancelled = true;
    };
  }, [prediction]);

  useEffect(() => {
    if (!prediction?.matchId) {
      setPreMatch(null);
      return;
    }
    const id = Number.parseInt(prediction.matchId, 10);
    if (!Number.isFinite(id)) return;

    let cancelled = false;
    setPreMatchErr(false);
    setPreMatchLoading(true);
    getMatchPrematchAnalysis(id)
      .then((d) => {
        if (!cancelled) setPreMatch(d);
      })
      .catch(() => {
        if (!cancelled) setPreMatchErr(true);
      })
      .finally(() => {
        if (!cancelled) setPreMatchLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prediction?.matchId]);

  const generatedAnalysis = useMemo(() => {
    if (!prediction) return [];
    return generateFootballAnalysisParagraphs(prediction, matchDetail);
  }, [prediction, matchDetail]);

  useEffect(() => {
    if (!prediction) return;
    const desc = seoInput?.description ?? '';
    const start = prediction.startTime;
    const payload: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'SportsEvent',
      name: `${prediction.homeTeam} × ${prediction.awayTeam}`,
      description: desc,
      sport: 'Soccer',
      startDate: start,
      eventStatus:
        prediction.resultStatus === 'PENDING'
          ? 'https://schema.org/EventScheduled'
          : 'https://schema.org/EventCompleted',
      competitor: [
        { '@type': 'SportsTeam', name: prediction.homeTeam.trim() },
        { '@type': 'SportsTeam', name: prediction.awayTeam.trim() },
      ],
    };
    if (prediction.league) {
      payload.location = {
        '@type': 'Place',
        name: prediction.league.trim(),
      };
    }
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-jsonld', 'sport');
    script.textContent = JSON.stringify(payload);
    document.head.appendChild(script);
    return () => {
      document.head.querySelector('[data-seo-jsonld="sport"]')?.remove();
    };
  }, [prediction, seoInput]);

  if (!slug || !parsed) {
    return <Navigate to="/prognosticos" replace />;
  }

  if (loading) {
    return (
      <div className={styles.wrap}>
        <Group justify="center" py="xl">
          <Loader color="green" />
        </Group>
      </div>
    );
  }

  if (notFound || !prediction) {
    return (
      <div className={styles.wrap}>
        <Alert color="yellow" title="Palpite não encontrado">
          Não há palpite automático para este jogo nesta data, ou o link está incorreto.
        </Alert>
        <Anchor component={Link} to="/prognosticos" mt="md" display="block" size="sm">
          Ver prognósticos
        </Anchor>
      </div>
    );
  }

  const showFullAnalysis =
    !prediction.locked || (isLoggedIn && canAccessPaidPredictions(plan));

  const prob =
    prediction.probability == null ?
      null
    : typeof prediction.probability === 'string' ?
      Number.parseFloat(prediction.probability)
    : prediction.probability;

  const odd =
    prediction.odd == null ?
      null
    : typeof prediction.odd === 'string' ?
      Number.parseFloat(prediction.odd)
    : prediction.odd;

  return (
    <article className={styles.wrap}>
      <header className={styles.hero}>
        <p className={styles.league}>{prediction.league}</p>
        <h1 className={styles.title}>
          Palpite {prediction.homeTeam} × {prediction.awayTeam}: análise e previsão
        </h1>
        <p className={styles.meta}>
          {formatKickoff(prediction.startTime)}
          {prediction.finalScore ? ` · Resultado: ${prediction.finalScore}` : ''}
        </p>
      </header>

      <Stack gap="md">
        <section aria-labelledby="sec-analise">
          <h2 id="sec-analise" className={styles.h2Semantic}>
            Análise do confronto
          </h2>
          {showFullAnalysis && prediction.analysis?.trim() ?
            <div className={styles.sectionBody}>
              {prediction.analysis.split(/\n+/).map((para, i) => (
                <p key={`a-${i}`} className={styles.paraMuted}>
                  {para}
                </p>
              ))}
            </div>
          : prediction.locked ?
            <Alert color="violet" p="sm">
              Texto integral premium — vê{' '}
              <Anchor component={Link} to="/planos" fw={600}>
                planos
              </Anchor>
              .
            </Alert>
          : null}

          <div className={styles.sectionBody}>
            {generatedAnalysis.map((para, i) => (
              <p key={`g-${i}`} className={styles.paraMuted}>
                {para}
              </p>
            ))}
          </div>
        </section>

        <Divider color="dark.6" variant="dashed" my={4} />

        <section aria-labelledby="sec-dossier">
          <h2 id="sec-dossier" className={styles.h2Semantic}>
            Dossiê de dados (pré-jogo)
          </h2>
          <p className={styles.paraMuted}>
            Classificação, forma recente, confrontos diretos, médias de golos e recorte casa/fora
            (quando a competição publica tabelas). Escalações surgem quando a API as disponibiliza.
          </p>
          {preMatchLoading && (
            <Group justify="center" py="md">
              <Loader size="sm" color="green" />
            </Group>
          )}
          {preMatchErr && (
            <Text size="sm" c="dimmed">
              Não foi possível carregar o dossier estatístico agora.
            </Text>
          )}
          {preMatch && <PreMatchDossierBlock data={preMatch} />}
        </section>

        <Divider color="dark.6" variant="dashed" my={4} />

        <section aria-labelledby="sec-h2h-dados">
          <h2 id="sec-h2h-dados" className={styles.h2Semantic}>
            Confrontos diretos (H2H)
          </h2>
          {preMatch && preMatch.headToHead.matches.length > 0 ?
            <Stack gap="sm">
              <Text size="xs" c="dimmed">
                Nos últimos {preMatch.headToHead.matches.length} encontros contabilizados:{' '}
                <strong>{prediction.homeTeam.trim()}</strong>{' '}
                {preMatch.headToHead.homeWins} vitórias · {preMatch.headToHead.draws} empates ·{' '}
                <strong>{prediction.awayTeam.trim()}</strong> {preMatch.headToHead.awayWins} vitórias
                (perspetiva do jogo atual).
              </Text>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Data</Table.Th>
                    <Table.Th>Casa</Table.Th>
                    <Table.Th>Resultado</Table.Th>
                    <Table.Th>Fora</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {preMatch.headToHead.matches.map((m, i) => (
                    <Table.Tr key={`h2h-${i}`}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatShortDate(m.utcDate)}</Table.Td>
                      <Table.Td>{m.homeTeam}</Table.Td>
                      <Table.Td>
                        {m.homeScore} × {m.awayScore}
                      </Table.Td>
                      <Table.Td>{m.awayTeam}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          : (
            <p className={styles.paraMuted}>
              {generateH2HNarrativeParagraph(
                prediction.homeTeam.trim(),
                prediction.awayTeam.trim(),
              )}
            </p>
          )}
        </section>

        <Divider color="dark.6" variant="dashed" my={4} />

        <section aria-labelledby="sec-stats">
          <h2 id="sec-stats" className={styles.h2Semantic}>
            Estatísticas e momento das equipas
          </h2>
          <p className={styles.paraMuted}>
            Probabilidades do modelo cruzadas com dados do jogo quando a API responder.
          </p>

          <div className={styles.statGrid}>
            <Paper className={styles.statCell} p={0}>
              <div className={styles.statLabel}>Placar</div>
              <div className={styles.statValue}>
                {matchDetail ?
                  `${matchDetail.homeScore} × ${matchDetail.awayScore}`
                : prediction.finalScore ?? '—'}
              </div>
            </Paper>
            {matchDetail?.halfTime != null && (
              <Paper className={styles.statCell} p={0}>
                <div className={styles.statLabel}>Ao intervalo</div>
                <div className={styles.statValue}>
                  {matchDetail.halfTime.home} × {matchDetail.halfTime.away}
                </div>
              </Paper>
            )}
            {matchDetail?.status && (
              <Paper className={styles.statCell} p={0}>
                <div className={styles.statLabel}>Estado</div>
                <div className={styles.statValue}>{matchDetail.status}</div>
              </Paper>
            )}
            {prob != null && Number.isFinite(prob) && (
              <Paper className={styles.statCell} p={0}>
                <div className={styles.statLabel}>Confiança do modelo</div>
                <div className={styles.statValue}>{formatProb(prob)}</div>
              </Paper>
            )}
            {odd != null && odd > 0 && (
              <Paper className={styles.statCell} p={0}>
                <div className={styles.statLabel}>Odd referência</div>
                <div className={styles.statValue}>{odd.toFixed(2)}</div>
              </Paper>
            )}
          </div>
          {!matchDetail && !detailErr && (
            <Text size="xs" c="dimmed" mt={6}>
              Ficha do encontro: ID {prediction.matchId}.
            </Text>
          )}
          {detailErr && (
            <Text size="xs" c="dimmed" mt="sm">
              Não foi possível sincronizar a ficha do jogo agora — as probabilidades abaixo permanecem da nossa prévia.
            </Text>
          )}
          {(prediction.probHome != null ||
            prediction.probDraw != null ||
            prediction.probAway != null) && (
            <Paper mt="md" p="sm" withBorder style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <Text size="xs" fw={600} mb="xs">
                Prob. 1X2 referência
              </Text>
              <Group grow gap="xs">
                <div>
                  <Text size="xs" c="dimmed">
                    Casa
                  </Text>
                  <Text size="sm" fw={700}>
                    {formatProb(prediction.probHome ?? null)}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Empate
                  </Text>
                  <Text size="sm" fw={700}>
                    {formatProb(prediction.probDraw ?? null)}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Fora
                  </Text>
                  <Text size="sm" fw={700}>
                    {formatProb(prediction.probAway ?? null)}
                  </Text>
                </div>
              </Group>
            </Paper>
          )}
        </section>

        <Divider color="dark.6" variant="dashed" my={4} />

        <section aria-labelledby="sec-final">
          <h2 id="sec-final" className={styles.h2Semantic}>
            Previsão final
          </h2>
          <Stack gap="xs">
            <Text size="sm" className={styles.paraMuted} component="p">
              <strong style={{ color: 'var(--app-text-muted)' }}>Mercado:</strong>{' '}
              {marketLabel(prediction.market ?? null)}
              {prediction.bestBet?.trim() ? (
                <>
                  {' '}
                  · <strong>Sugestão:</strong> {prediction.bestBet}
                </>
              ) : null}
              {prediction.confidence != null && Number.isFinite(Number(prediction.confidence)) ?
                ` · Confiança ${Number(prediction.confidence).toFixed(1)}/10.`
              : null}{' '}
              Apenas entretenimento; joga com responsabilidade.
            </Text>
          </Stack>
        </section>

        <SeoTopicLinks
          homeTeam={prediction.homeTeam}
          awayTeam={prediction.awayTeam}
          leagueName={prediction.league}
        />

        <Anchor component={Link} to="/prognosticos" size="sm">
          ← Voltar aos prognósticos
        </Anchor>
      </Stack>
    </article>
  );
}

export default MatchPredictionPage;
