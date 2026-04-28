import { Link, NavLink } from 'react-router-dom';
import {
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
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <header className={classes.header}>
      <div className={classes.inner}>
        <Group justify="space-between" wrap="nowrap">
          <Link to="/" className={classes.logo}>
            <Text fw={700} size="xl" className={classes.logoText}>SmartGol</Text>
          </Link>

          <Group className={classes.desktopLinks} gap="md">
            <NavLink to="/" end className={({ isActive }) => `${classes.navLink} ${isActive ? classes.navLinkActive : ''}`}>Jogos</NavLink>
            <NavLink to="/prognosticos" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.navLinkActive : ''}`}>Palpites</NavLink>
            {isLoggedIn && canSeeHistory(plan) && (
              <NavLink to="/historico" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.navLinkActive : ''}`}>Histórico</NavLink>
            )}
            <NavLink to="/planos" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.navLinkActive : ''}`}>Planos</NavLink>
            <NavLink to="/premium" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.navLinkActive : ''}`}>VIP</NavLink>
          </Group>

          <Group gap="xs" className={classes.desktopActions}>
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
                <Group gap={6} className={classes.planBadge}>
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
          </Group>

          <Burger
            opened={opened}
            onClick={opened ? close : open}
            hiddenFrom="md"
            size="sm"
            aria-label="Abrir menu"
          />
        </Group>

        <div className={classes.mobileQuickLinks}>
          <NavLink to="/" end className={({ isActive }) => `${classes.mobileQuickLink} ${isActive ? classes.mobileQuickLinkActive : ''}`}>Jogos</NavLink>
          <NavLink to="/prognosticos" className={({ isActive }) => `${classes.mobileQuickLink} ${isActive ? classes.mobileQuickLinkActive : ''}`}>Palpites</NavLink>
          {isLoggedIn && canSeeHistory(plan) && (
            <NavLink to="/historico" className={({ isActive }) => `${classes.mobileQuickLink} ${isActive ? classes.mobileQuickLinkActive : ''}`}>Histórico</NavLink>
          )}
          <NavLink to="/planos" className={({ isActive }) => `${classes.mobileQuickLink} ${isActive ? classes.mobileQuickLinkActive : ''}`}>Planos</NavLink>
          <NavLink to="/premium" className={({ isActive }) => `${classes.mobileQuickLink} ${isActive ? classes.mobileQuickLinkActive : ''}`}>VIP</NavLink>
        </div>

        <Drawer
          opened={opened}
          onClose={close}
          title="Menu"
          position="right"
          hiddenFrom="md"
          classNames={{ body: classes.drawerBody }}
        >
          <Stack gap="sm">
            <NavLink to="/" end className={({ isActive }) => `${classes.mobileLink} ${isActive ? classes.mobileLinkActive : ''}`} onClick={close}>Jogos</NavLink>
            <NavLink to="/prognosticos" className={({ isActive }) => `${classes.mobileLink} ${isActive ? classes.mobileLinkActive : ''}`} onClick={close}>Palpites</NavLink>
            {isLoggedIn && canSeeHistory(plan) && (
              <NavLink to="/historico" className={({ isActive }) => `${classes.mobileLink} ${isActive ? classes.mobileLinkActive : ''}`} onClick={close}>Histórico</NavLink>
            )}
            <NavLink to="/planos" className={({ isActive }) => `${classes.mobileLink} ${isActive ? classes.mobileLinkActive : ''}`} onClick={close}>Planos</NavLink>
            <NavLink to="/premium" className={({ isActive }) => `${classes.mobileLink} ${isActive ? classes.mobileLinkActive : ''}`} onClick={close}>VIP</NavLink>
            <Divider my="xs" />
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
