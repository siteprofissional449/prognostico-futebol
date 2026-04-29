/**
 * SPA / Vite: SEO via meta OG + canonical no cliente (equiv. parcial ao generateMetadata do Next.js).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Divider,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from '@mantine/core';
import {
  getHomePredictions,
  getMyPredictionsList,
  getPublicPredictionsList,
} from '../api/predictions';
import { getMatchDetail } from '../api/football';
import type { MatchDetail, PredictionView } from '../types';
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

export function MatchPredictionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isLoggedIn, plan } = useAuth();
  const parsed = slug ? parsePalpiteSlug(slug) : null;

  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<PredictionView | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [detailErr, setDetailErr] = useState(false);

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

      <Stack gap="xl">
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
            <Alert color="violet">
              Esta análise textual completa é premium. Planeia o teu acesso aos palpites com plano compatível.
              <Anchor component={Link} to="/planos" display="block" mt="xs" fw={600}>
                Ver planos
              </Anchor>
            </Alert>
          : null}

          <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs" mt={showFullAnalysis ? 'md' : 0}>
            Visão do modelo — contexto
          </Text>
          <div className={styles.sectionBody}>
            {generatedAnalysis.map((para, i) => (
              <p key={`g-${i}`} className={styles.paraMuted}>
                {para}
              </p>
            ))}
          </div>
        </section>

        <Divider color="dark.6" />

        <section aria-labelledby="sec-stats">
          <h2 id="sec-stats" className={styles.h2Semantic}>
            Estatísticas e momento das equipas
          </h2>
          <p className={styles.paraMuted}>
            Sintetizamos probabilidades relativas aos mercados destacados pela nossa ferramenta, cruzadas com dados de
            jogo sempre que a feed desportiva estiver disponível.
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
            <Text size="xs" c="dimmed" mt="sm">
              Ligação aos detalhes do encontro (ID {prediction.matchId}) quando a API partilhar ficha técnica.
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

        <Divider color="dark.6" />

        <section aria-labelledby="sec-h2h">
          <h2 id="sec-h2h" className={styles.h2Semantic}>
            Histórico de confrontos diretos (H2H)
          </h2>
          <p className={styles.paraMuted}>
            {generateH2HNarrativeParagraph(prediction.homeTeam.trim(), prediction.awayTeam.trim())}
          </p>
        </section>

        <Divider color="dark.6" />

        <section aria-labelledby="sec-final">
          <h2 id="sec-final" className={styles.h2Semantic}>
            Previsão final
          </h2>
          <Stack gap="sm">
            <Text size="sm" className={styles.paraMuted} component="p">
              <strong style={{ color: 'var(--app-text-muted)' }}>Mercado:</strong>{' '}
              {marketLabel(prediction.market ?? null)}
            </Text>
            {prediction.bestBet?.trim() && (
              <Text size="sm" className={styles.paraMuted} component="p">
                <strong style={{ color: 'var(--app-text-muted)' }}>Ideia pragmática:</strong>{' '}
                {prediction.bestBet}
              </Text>
            )}
            <Text size="sm" className={styles.paraMuted} component="p">
              O combinado probabilístico reforça a leitura de matriz de risco/retorno: aposta apenas com responsabilidade
              e dentro do teu budget.
            </Text>
            {prediction.confidence != null && Number.isFinite(Number(prediction.confidence)) && (
              <Text size="sm" className={styles.paraMuted} component="p">
                <strong style={{ color: 'var(--app-text-muted)' }}>Robustez combinada:</strong>{' '}
                {Number(prediction.confidence).toFixed(1)} / 10
              </Text>
            )}
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
