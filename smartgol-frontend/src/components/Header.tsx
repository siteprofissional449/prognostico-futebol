import { Link } from 'react-router-dom';
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
            <Text fw={700} size="xl">SmartGol</Text>
          </Link>

          <Group className={classes.desktopLinks} gap="md">
            <Link to="/" className={classes.navLink}>Jogos</Link>
            <Link to="/prognosticos" className={classes.navLink}>Palpites</Link>
            {isLoggedIn && canSeeHistory(plan) && (
              <Link to="/historico" className={classes.navLink}>Histórico</Link>
            )}
            <Link to="/planos" className={classes.navLink}>Planos</Link>
            <Link to="/premium" className={classes.navLink}>VIP</Link>
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
            hiddenFrom="sm"
            size="sm"
            aria-label="Abrir menu"
          />
        </Group>

        <Drawer
          opened={opened}
          onClose={close}
          title="Menu"
          position="right"
          hiddenFrom="sm"
          classNames={{ body: classes.drawerBody }}
        >
          <Stack gap="sm">
            <Link to="/" className={classes.mobileLink} onClick={close}>Jogos</Link>
            <Link to="/prognosticos" className={classes.mobileLink} onClick={close}>Palpites</Link>
            {isLoggedIn && canSeeHistory(plan) && (
              <Link to="/historico" className={classes.mobileLink} onClick={close}>Histórico</Link>
            )}
            <Link to="/planos" className={classes.mobileLink} onClick={close}>Planos</Link>
            <Link to="/premium" className={classes.mobileLink} onClick={close}>VIP</Link>
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
