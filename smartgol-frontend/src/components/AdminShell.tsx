import { Link, Outlet, useLocation } from 'react-router-dom';
import { Button, Container, Group, Title } from '@mantine/core';
import { IconLayoutDashboard, IconUsers, IconBallFootball } from '@tabler/icons-react';

export function AdminShell() {
  const { pathname } = useLocation();

  return (
    <Container size="xl" py="lg">
      <Group justify="space-between" mb="xl" wrap="wrap">
        <Title order={2}>Área administrativa</Title>
        <Group gap="xs">
          <Button
            component={Link}
            to="/admin"
            variant={pathname === '/admin' ? 'filled' : 'light'}
            size="sm"
            leftSection={<IconLayoutDashboard size={16} />}
          >
            Painel
          </Button>
          <Button
            component={Link}
            to="/admin/usuarios"
            variant={pathname.startsWith('/admin/usuarios') ? 'filled' : 'light'}
            size="sm"
            leftSection={<IconUsers size={16} />}
          >
            Usuários
          </Button>
          <Button
            component={Link}
            to="/admin/prognosticos"
            variant={pathname.startsWith('/admin/prognosticos') ? 'filled' : 'light'}
            size="sm"
            leftSection={<IconBallFootball size={16} />}
          >
            Prognósticos
          </Button>
          <Button component={Link} to="/" variant="subtle" size="sm">
            Voltar ao site
          </Button>
        </Group>
      </Group>
      <Outlet />
    </Container>
  );
}
