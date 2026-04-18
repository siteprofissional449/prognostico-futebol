import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Divider,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconSparkles, IconTrash } from '@tabler/icons-react';
import { adminClearPredictions, adminGeneratePredictions, getAdminStats } from '../api/admin';
import { notifications } from '@mantine/notifications';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function AdminDashboard() {
  const [stats, setStats] = useState<{ userCount: number; predictionCount: number } | null>(null);
  const [genDate, setGenDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [clearDate, setClearDate] = useState('');
  const [resetMeta, setResetMeta] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

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
      const detail =
        `Data: ${r.date} · candidatos: ${r.candidates} · gravados: ${r.count} · ` +
        `motivo: ${r.reason} · dup: ${r.skippedDuplicate} · sem odds: ${r.skippedNoOdds} · ` +
        `odd baixa: ${r.skippedOddTooLow} · erros: ${r.skippedErrors} · ` +
        `montados: ${r.built} · pós-filtro: ${r.afterOddFilter}`;
      notifications.show({
        color: r.count > 0 ? 'green' : 'yellow',
        title: 'Geração concluída',
        message: detail,
      });
      reloadStats();
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

  const reloadStats = () => {
    getAdminStats()
      .then(setStats)
      .catch(() => {
        /* já notificamos no mount; falha silenciosa aqui */
      });
  };

  const runClear = async () => {
    const d = (clearDate.trim() || todayISO()).trim();
    setClearing(true);
    try {
      const r = await adminClearPredictions(d, resetMeta);
      notifications.show({
        color: 'green',
        title: 'Limpeza concluída',
        message: `Removidos ${r.deleted} palpite(s) de ${r.date}.`,
      });
      closeConfirm();
      reloadStats();
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Falha ao limpar',
        message: e instanceof Error ? e.message : 'Erro desconhecido',
      });
    } finally {
      setClearing(false);
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

      <Paper p="lg" radius="md" withBorder mt="xl">
        <Text size="sm" c="dimmed" tt="uppercase" fw={600} mb="xs">
          Limpar prognósticos (por dia)
        </Text>
        <Text size="sm" c="dimmed" mb="md">
          Remove do banco todos os palpites automáticos da data (útil após testes/mock). Isto não apaga
          prognósticos manuais do menu <Text span fw={600}>Admin → Prognósticos</Text>.
        </Text>
        <Group align="flex-end" wrap="wrap">
          <TextInput
            label="Data (YYYY-MM-DD)"
            placeholder={todayISO()}
            value={clearDate}
            onChange={(e) => setClearDate(e.currentTarget.value)}
            w={220}
          />
          <Checkbox
            label="Repor registo da última geração"
            checked={resetMeta}
            onChange={(e) => setResetMeta(e.currentTarget.checked)}
          />
          <Button
            color="red"
            variant="light"
            leftSection={<IconTrash size={18} />}
            onClick={openConfirm}
          >
            Limpar dia
          </Button>
        </Group>
      </Paper>

      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title="Confirmar limpeza"
        centered
      >
        <Text size="sm" mb="md">
          Tem a certeza que quer apagar <strong>todos</strong> os prognósticos automáticos do dia{' '}
          <strong>{clearDate.trim() || todayISO()}</strong>?
        </Text>
        <Divider my="sm" />
        <Group justify="flex-end">
          <Button variant="default" onClick={closeConfirm} disabled={clearing}>
            Cancelar
          </Button>
          <Button color="red" loading={clearing} onClick={runClear}>
            Apagar
          </Button>
        </Group>
      </Modal>
    </>
  );
}
