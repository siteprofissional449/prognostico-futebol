import { Link, Navigate, useParams } from 'react-router-dom';
import { Container, Stack, Text, Title, Anchor } from '@mantine/core';
import { useSeoMeta } from '../hooks/useSeoMeta';

function slugToTitle(slug: string | undefined) {
  if (!slug?.trim()) return null;
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function Liga() {
  const { slug } = useParams<{ slug: string }>();
  const label = slugToTitle(slug);

  useSeoMeta(
    label ? `${label} — palpites e calendário` : 'Liga',
    label ?
      `${label}: hub programático SmartGol com ligações a prognósticos e páginas de equipas.`
    : undefined,
  );

  if (!slug || slug.trim().length < 2 || !label) {
    return <Navigate to="/prognosticos" replace />;
  }

  return (
    <Container size="sm" py="xl" pb={{ base: '6rem', sm: '2rem' }}>
      <article>
        <Title order={1} size="h2" mb="md">
          {label}
        </Title>
        <Stack gap="md">
          <Text size="sm" c="dimmed" lh={1.75}>
            O SmartGol reúne palpites do dia através de competições. Explora prognósticos filtrados e equipas quando
            houver fichas públicas criadas pela app.
          </Text>
          <Anchor component={Link} to="/prognosticos" size="sm">
            Ver prognósticos para hoje
          </Anchor>
        </Stack>
      </article>
    </Container>
  );
}
