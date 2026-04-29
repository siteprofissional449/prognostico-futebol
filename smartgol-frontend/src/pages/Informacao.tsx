import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Container, Text, Anchor, Stack, Title } from '@mantine/core';
import type { InformacaoSlug } from '../routes/informacaoRoutes';
import {
  INFORMACAO_SLUGS,
  INFORMACAO_TITULOS,
  isInformacaoSlug,
} from '../routes/informacaoRoutes';

/**
 * Placeholder institucional. Substitui por texto final / CMS quando disponível.
 */
export function Informacao() {
  const { slug } = useParams<{ slug: string }>();
  const valid = slug && isInformacaoSlug(slug);

  const title = useMemo(() => {
    if (!valid) return '';
    return INFORMACAO_TITULOS[slug as InformacaoSlug];
  }, [slug, valid]);

  if (!slug || !valid) {
    return <Navigate to="/" replace />;
  }

  const year = new Date().getFullYear();
  const s = slug as InformacaoSlug;

  const mainLinks: { to: string; label: string }[] = [
    { to: '/', label: 'Início (Jogos)' },
    { to: '/prognosticos', label: 'Palpites' },
    { to: '/historico', label: 'Histórico' },
    { to: '/planos', label: 'Planos' },
    { to: '/premium', label: 'VIP' },
    { to: '/login', label: 'Entrar' },
    { to: '/register', label: 'Registo' },
  ];

  return (
    <Container size="sm" py="xl" pb="calc(8rem + env(safe-area-inset-bottom, 0px))">
      <Stack gap="lg">
        <Title order={1} size="h2" fw={600}>
          {title}
        </Title>

        {s === 'mapa-do-site' ? (
          <Stack gap="md">
            <Text size="sm" fw={600}>
              Secções principais
            </Text>
            <Stack gap={6}>
              {mainLinks.map(({ to, label }) => (
                <Anchor key={to} component={Link} to={to} size="sm">
                  {label}
                </Anchor>
              ))}
            </Stack>
            <Text size="sm" fw={600} mt="sm">
              Informação institucional
            </Text>
            <Stack gap={6}>
              {INFORMACAO_SLUGS.filter((k) => k !== 'mapa-do-site').map((k) => (
                <Anchor key={k} component={Link} to={`/informacao/${k}`} size="sm">
                  {INFORMACAO_TITULOS[k]}
                </Anchor>
              ))}
            </Stack>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed" lh={1.7}>
            Conteúdo em atualização. Quando tiveres os textos jurídicos e editoriais finais,
            substitui esta secção.
          </Text>
        )}
        <Anchor component={Link} to="/" size="sm">
          Voltar ao início
        </Anchor>
        <Text size="xs" c="dimmed" mt="lg">
          © {year} smartgol
        </Text>
      </Stack>
    </Container>
  );
}

/** Para lazy import sem depender das rotas públicas todas listadas aqui duas vezes */
export default Informacao;
