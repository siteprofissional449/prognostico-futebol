import { useEffect, useState } from 'react';
import { Paper, SimpleGrid, Text, Title } from '@mantine/core';
import { getAdminStats } from '../api/admin';
import { notifications } from '@mantine/notifications';

export function AdminDashboard() {
  const [stats, setStats] = useState<{ userCount: number; predictionCount: number } | null>(null);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((e) => {
        notifications.show({
          color: 'red',
          message: e instanceof Error ? e.message : 'Erro ao carregar estatísticas',
        });
      });
  }, []);

  return (
    <>
      <Title order={3} mb="md" c="dimmed">
        Visão geral
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Paper p="lg" radius="md" withBorder>
          <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
            Usuários cadastrados
          </Text>
          <Title order={2} mt="xs">
            {stats != null ? stats.userCount : '—'}
          </Title>
        </Paper>
        <Paper p="lg" radius="md" withBorder>
          <Text size="sm" c="dimmed" tt="uppercase" fw={600}>
            Prognósticos no banco
          </Text>
          <Title order={2} mt="xs">
            {stats != null ? stats.predictionCount : '—'}
          </Title>
        </Paper>
      </SimpleGrid>
    </>
  );
}
