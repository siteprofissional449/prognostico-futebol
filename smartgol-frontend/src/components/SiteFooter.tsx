import { Link } from 'react-router-dom';
import { Anchor, Box, Divider, Group, Stack, Text } from '@mantine/core';
import type { InformacaoSlug } from '../routes/informacaoRoutes';
import { INFORMACAO_TITULOS } from '../routes/informacaoRoutes';
import classes from './SiteFooter.module.css';

const FOOTER_LINKS: { slug: InformacaoSlug; label: string }[] = (
  Object.entries(INFORMACAO_TITULOS) as [InformacaoSlug, string][]
).map(([slug, label]) => ({ slug, label }));

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={classes.footer} role="contentinfo">
      <Box className={classes.inner}>
        <Stack gap="md">
          <Divider color="dark.5" variant="dashed" />

          {/* Jogo responsável — alinhamento com mensagens institucionais / IBJR */}
          <Stack gap="xs" align="center" className={classes.responsibleBlock}>
            <Text size="sm" fw={600}>
              Jogue com responsabilidade
            </Text>
            <Group gap="xl" justify="center" wrap="wrap">
              <Box className={classes.ageBadge} title="Menores não podem jogar ou apostar." aria-hidden>
                18+
              </Box>
              <Anchor
                href="https://www.ibjr.org.br/"
                target="_blank"
                rel="noopener noreferrer"
                size="xs"
                className={classes.ibjrLink}
              >
                IBJR
              </Anchor>
            </Group>
          </Stack>

          <Divider color="dark.5" variant="dashed" />

          {/* Links institucionais */}
          <nav className={classes.nav} aria-label="Informações institucionais">
            <div className={classes.linkWrap}>
              {FOOTER_LINKS.map(({ slug, label }) => (
                <Anchor
                  key={slug}
                  component={Link}
                  to={`/informacao/${slug}`}
                  size="sm"
                  className={classes.link}
                >
                  {label}
                </Anchor>
              ))}
            </div>
          </nav>

          <Text size="xs" c="dimmed" ta="center" lh={1.6}>
            Copyright © {year} smartgol — Todos os direitos reservados
          </Text>
        </Stack>
      </Box>
    </footer>
  );
}
