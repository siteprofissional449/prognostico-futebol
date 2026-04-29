import { Link, NavLink } from 'react-router-dom';
import {
  Box,
  Group,
  Button,
  Text,
  Burger,
  Drawer,
  Stack,
  Divider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUser, IconLogin, IconShield } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { canSeeHistory } from '../utils/planAccess';
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
  const [opened, { close, toggle }] = useDisclosure(false);

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
            onClick={toggle}
            hiddenFrom="md"
            size="sm"
            aria-label={opened ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={opened}
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
          size="sm"
          zIndex={400}
          classNames={{ body: classes.drawerBody }}
          lockScroll
          trapFocus
          withinPortal
        >
          <Stack gap="xs">
            <NavLink to="/" end onClick={close} className={({ isActive }) => `${classes.mobileLink} ${isActive ? classes.mobileLinkActive : ''}`}>Jogos</NavLink>
            <NavLink to="/prognosticos" onClick={close} className={({ isActive }) => `${classes.mobileLink} ${isActive ? classes.mobileLinkActive : ''}`}>Palpites</NavLink>
            {isLoggedIn && canSeeHistory(plan) && (
              <NavLink to="/historico" onClick={close} className={({ isActive }) => `${classes.mobileLink} ${isActive ? classes.mobileLinkActive : ''}`}>Histórico</NavLink>
            )}
            <NavLink to="/planos" onClick={close} className={({ isActive }) => `${classes.mobileLink} ${isActive ? classes.mobileLinkActive : ''}`}>Planos</NavLink>
            <NavLink to="/premium" onClick={close} className={({ isActive }) => `${classes.mobileLink} ${isActive ? classes.mobileLinkActive : ''}`}>VIP</NavLink>

            <Divider
              my="xs"
              labelPosition="left"
              label={<Text size="xs" fw={600} c="dimmed" tt="uppercase">Conta</Text>}
            />

            {isLoggedIn ? (
              <Stack gap="sm">
                {isAdmin && (
                  <Button
                    component={Link}
                    to="/admin"
                    variant="light"
                    color="violet"
                    onClick={close}
                    leftSection={<IconShield size={16} />}
                  >
                    Administrador
                  </Button>
                )}
                <Group gap={6} className={classes.planBadge} wrap="nowrap">
                  <IconUser size={18} />
                  <Text size="sm" c="dimmed">
                    Plano: {plan ? planLabels[plan] ?? plan : '—'}
                  </Text>
                </Group>
                <Button variant="light" onClick={() => { close(); logout(); }}>
                  Sair
                </Button>
              </Stack>
            ) : (
              <Button component={Link} to="/login" onClick={close} leftSection={<IconLogin size={16} />} variant="filled" fullWidth>
                Entrar
              </Button>
            )}
          </Stack>
        </Drawer>
      </div>
    </header>
  );
}
