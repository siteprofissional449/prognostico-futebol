import { useEffect, useState } from 'react';
import { Button, Group, Paper, SimpleGrid, Text, TextInput, Title } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { adminGeneratePredictions, getAdminStats } from '../api/admin';
import { notifications } from '@mantine/notifications';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminDashboard() {
  const [stats, setStats] = useState<{ userCount: number; predictionCount: number } | null>(null);
  const [genDate, setGenDate] = useState('');
  const [generating, setGenerating] = useState(false);

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

  const runGenerate = async () => {
    setGenerating(true);
    try {
      const dateArg = genDate.trim() || undefined;
      const r = await adminGeneratePredictions(dateArg);
      notifications.show({
        color: 'green',
        title: 'Geração concluída',
        message: `${r.count} palpite(s) gravado(s).`,
      });
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Falha na geração',
        message: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setGenerating(false);
    }
  };

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

      <Paper p="lg" radius="md" withBorder mt="xl">
        <Text size="sm" c="dimmed" tt="uppercase" fw={600} mb="xs">
          Geração automática (IA + API futebol)
        </Text>
        <Text size="sm" c="dimmed" mb="md">
          O mesmo fluxo do cron. Deixe a data vazia para o dia de hoje ({todayISO()} UTC). Só administradores.
        </Text>
        <Group align="flex-end" wrap="wrap">
          <TextInput
            label="Data (opcional)"
            placeholder="YYYY-MM-DD"
            value={genDate}
            onChange={(e) => setGenDate(e.currentTarget.value)}
            w={200}
          />
          <Button
            leftSection={<IconSparkles size={18} />}
            loading={generating}
            onClick={runGenerate}
          >
            Gerar prognósticos
          </Button>
        </Group>
      </Paper>
    </>
  );
}
