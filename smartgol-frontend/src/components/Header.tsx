import { Link, NavLink } from 'react-router-dom';
import {
  Box,
  Group,
  Button,
  Text,
  Burger,
  Drawer,
  Stack,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconUser, IconLogin, IconShield } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { canSeeHistory } from '../utils/planAccess';
import { mediaQueryBelow } from '../theme/breakpoints';
import classes from './Header.module.css';

const planLabels: Record<string, string> = {
  FREE: 'Grátis',
  DAILY: 'Diário',
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensal',
  PREMIUM: 'Mensal',
};

export function Header() {
  const { isLoggedIn, plan, isAdmin, logout } = useAuth();
  const [opened, { open, close }] = useDisclosure(false);
  /** Igual ao breakpoint `sm` (barra inferior, padding layout, etc.). */
  const hasBottomIconsNav = useMediaQuery(mediaQueryBelow('sm'));

  return (
    <header className={classes.header}>
      <div className={classes.inner}>
        <Group justify="space-between" wrap="nowrap">
          <Link to="/" className={classes.logo}>
            <Text fw={700} size="xl" className={classes.logoText}>SmartGol</Text>
          </Link>

          <Box visibleFrom="md" component={Group} gap="md" wrap="nowrap">
            <NavLink to="/" end className={({ isActive }) => `${classes.navLink} ${isActive ? classes.navLinkActive : ''}`}>Jogos</NavLink>
            <NavLink to="/prognosticos" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.navLinkActive : ''}`}>Palpites</NavLink>
            {isLoggedIn && canSeeHistory(plan) && (
              <NavLink to="/historico" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.navLinkActive : ''}`}>Histórico</NavLink>
            )}
            <NavLink to="/planos" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.navLinkActive : ''}`}>Planos</NavLink>
            <NavLink to="/premium" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.navLinkActive : ''}`}>VIP</NavLink>
          </Box>

          <Box visibleFrom="md" component={Group} gap="xs" wrap="nowrap">
            {isLoggedIn ? (
              <>
                {isAdmin && (
                  <Button
                    component={Link}
                    to="/admin"
                    variant="light"
                    color="violet"
                    size="xs"
                    leftSection={<IconShield size={14} />}
                  >
                    Admin
                  </Button>
                )}
                <Group gap={6} className={classes.planBadge} wrap="nowrap">
                  <IconUser size={16} />
                  <Text size="sm" c="dimmed">
                    {plan ? planLabels[plan] ?? plan : '—'}
                  </Text>
                </Group>
                <Button variant="light" size="xs" onClick={logout}>Sair</Button>
              </>
            ) : (
              <Button component={Link} to="/login" leftSection={<IconLogin size={16} />} variant="filled" size="sm">
                Entrar
              </Button>
            )}
          </Box>

          <Burger
            opened={opened}
            onClick={opened ? close : open}
            hiddenFrom="md"
            size="sm"
            aria-label="Abrir menu"
          />
        </Group>

        {/* Tablet só: no telefone a navegação principal é a barra inferior (MobileBottomNav). */}
        <Box visibleFrom="sm" hiddenFrom="md" component="div" className={classes.mobileQuickLinks}>
          <NavLink to="/" end className={({ isActive }) => `${classes.mobileQuickLink} ${isActive ? classes.mobileQuickLinkActive : ''}`}>Jogos</NavLink>
          <NavLink to="/prognosticos" className={({ isActive }) => `${classes.mobileQuickLink} ${isActive ? classes.mobileQuickLinkActive : ''}`}>Palpites</NavLink>
          {isLoggedIn && canSeeHistory(plan) && (
            <NavLink to="/historico" className={({ isActive }) => `${classes.mobileQuickLink} ${isActive ? classes.mobileQuickLinkActive : ''}`}>Histórico</NavLink>
          )}
          <NavLink to="/planos" className={({ isActive }) => `${classes.mobileQuickLink} ${isActive ? classes.mobileQuickLinkActive : ''}`}>Planos</NavLink>
          <NavLink to="/premium" className={({ isActive }) => `${classes.mobileQuickLink} ${isActive ? classes.mobileQuickLinkActive : ''}`}>VIP</NavLink>
        </Box>

        <Drawer
          opened={opened}
          onClose={close}
          title="Menu"
          position="right"
          hiddenFrom="md"
          classNames={{ body: classes.drawerBody }}
        >
          <Stack gap="sm">
            {isLoggedIn ? (
              <>
                {isAdmin && (
                  <Button
                    component={Link}
                    to="/admin"
                    variant="light"
                    color="violet"
                    onClick={close}
                  >
                    Admin
                  </Button>
                )}
                <Text size="sm" c="dimmed">
                  {hasBottomIconsNav
                    ? 'Navegue pelos ícones na barra inferior. Aqui ficam plano e terminar sessão.'
                    : 'Use os atalhos logo abaixo do SmartGol para mudar de secção. Aqui ficam plano e sessão.'}
                </Text>
                <Text size="sm" c="dimmed">
                  Plano: {plan ? planLabels[plan] ?? plan : '—'}
                </Text>
                <Button variant="light" onClick={() => { close(); logout(); }}>
                  Sair
                </Button>
              </>
            ) : (
              <Button component={Link} to="/login" onClick={close} leftSection={<IconLogin size={16} />}>
                Entrar
              </Button>
            )}
          </Stack>
        </Drawer>
      </div>
    </header>
  );
}
