import { Link } from 'react-router-dom';
import { Anchor, Box, Divider, Group, Stack, Text } from '@mantine/core';
import { IconBrandFacebook, IconBrandInstagram, IconMail } from '@tabler/icons-react';
import type { InformacaoSlug } from '../routes/informacaoRoutes';
import { INFORMACAO_TITULOS } from '../routes/informacaoRoutes';
import classes from './SiteFooter.module.css';

const CONTACT_EMAIL = 'smartgol449@gmail.com';
const FACEBOOK_URL =
  'https://www.facebook.com/profile.php?id=61588771485793';
const INSTAGRAM_URL = 'https://www.instagram.com/smartgol449/';

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

          <Divider color="dark.5" variant="dashed" />

          <div className={classes.contactBlock}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} ta="center" style={{ letterSpacing: '0.06em' }}>
              Contato e redes
            </Text>
            <Group gap="md" justify="center" wrap="wrap" className={classes.contactRow}>
              <Anchor
                href={`mailto:${CONTACT_EMAIL}`}
                size="sm"
                className={classes.socialLink}
                underline="hover"
              >
                <span className={classes.socialInner}>
                  <IconMail size={18} stroke={1.5} aria-hidden />
                  <span>{CONTACT_EMAIL}</span>
                </span>
              </Anchor>
              <Anchor
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                className={classes.socialLink}
                underline="hover"
                aria-label="SmartGol no Facebook"
              >
                <span className={classes.socialInner}>
                  <IconBrandFacebook size={18} stroke={1.5} aria-hidden />
                  <span>Facebook</span>
                </span>
              </Anchor>
              <Anchor
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                size="sm"
                className={classes.socialLink}
                underline="hover"
                aria-label="SmartGol no Instagram (@smartgol449)"
              >
                <span className={classes.socialInner}>
                  <IconBrandInstagram size={18} stroke={1.5} aria-hidden />
                  <span>@smartgol449</span>
                </span>
              </Anchor>
            </Group>
          </div>

          <Text size="xs" c="dimmed" ta="center" lh={1.6}>
            Copyright © {year} smartgol — Todos os direitos reservados
          </Text>
        </Stack>
      </Box>
    </footer>
  );
}
