import { Link } from 'react-router-dom';
import { Group, Button, Text } from '@mantine/core';
import { IconUser, IconLogin, IconShield } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import classes from './Header.module.css';

const planLabels: Record<string, string> = {
  FREE: 'Grátis',
  DAILY: 'Diário',
  WEEKLY: 'Semanal',
  PREMIUM: 'Premium',
};

export function Header() {
  const { isLoggedIn, plan, isAdmin, logout } = useAuth();

  return (
    <header className={classes.header}>
      <Group justify="space-between" wrap="nowrap">
        <Link to="/" className={classes.logo}>
          <Text fw={700} size="xl">SmartGol</Text>
        </Link>
        <Group gap="md">
          <Link to="/" className={classes.navLink}>Jogos do dia</Link>
          <Link to="/planos" className={classes.navLink}>Planos</Link>
          <Link to="/premium" className={classes.navLink}>Área Premium</Link>
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
              <Group gap="xs">
                <IconUser size={18} />
                <Text size="sm" c="dimmed">{plan ? planLabels[plan] ?? plan : '—'}</Text>
              </Group>
              <Button variant="light" size="xs" onClick={logout}>Sair</Button>
            </>
          ) : (
            <Button component={Link} to="/login" leftSection={<IconLogin size={16} />} variant="filled" size="sm">
              Entrar
            </Button>
          )}
        </Group>
      </Group>
    </header>
  );
}
