import { Link, Navigate, useParams } from 'react-router-dom';
import { Container, Stack, Text, Title, Anchor } from '@mantine/core';
import { useSeoMeta } from '../hooks/useSeoMeta';

function slugToLabel(slug: string | undefined): string | null {
  if (!slug?.trim()) return null;
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Hub programático equipa‑nível — conteúdo único será enriquecido quando existir lista de jogos ligada ao clube na API.
 * Rotas SPA (Vite): não há SSG neste build; apenas meta no cliente + URL amigável.
 */
export default function Equipa() {
  const { slug } = useParams<{ slug: string }>();
  const name = slugToLabel(slug);

  const title = name ? `${name} — palpites e equipa` : 'Equipa';

  useSeoMeta(
    title,
    name ?
      `${name}: centro de página programática SmartGol. Explora prognósticos e ligas em destaque.`
    : undefined,
  );

  if (!slug || slug.trim().length < 2 || !name) return <Navigate to="/prognosticos" replace />;

  return (
    <Container size="sm" py="xl" pb={{ base: '6rem', sm: '2rem' }}>
      <article>
        <Title order={1} size="h2" mb="md">
          {name}
        </Title>
        <Stack gap="md">
          <Text size="sm" c="dimmed" lh={1.75}>
            Página programática de equipa no SmartGol. A partir daqui navegas para prognósticos do dia ou liga onde o
            clube pontua forte no calendário.
          </Text>
          <Anchor component={Link} to="/prognosticos" size="sm">
            Prognósticos de hoje
          </Anchor>
        </Stack>
      </article>
    </Container>
  );
}
