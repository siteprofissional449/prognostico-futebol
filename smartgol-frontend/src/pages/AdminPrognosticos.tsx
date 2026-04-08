import { useCallback, useEffect, useState } from 'react';
import {
  Table,
  Button,
  Badge,
  Modal,
  Select,
  TextInput,
  Textarea,
  Stack,
  Group,
  Text,
  NumberInput,
  ActionIcon,
  Tooltip,
  ScrollArea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';
import {
  listAdminPrognostics,
  createAdminPrognostic,
  updateAdminPrognostic,
  deleteAdminPrognostic,
} from '../api/prognostics';
import type { AdminPrognostic, PlanType, PrognosticStatus } from '../types';

const statusOptions: { value: PrognosticStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pendente' },
  { value: 'WON', label: 'Green' },
  { value: 'LOST', label: 'Red' },
];

const planOptions: { value: PlanType; label: string }[] = [
  { value: 'FREE', label: 'Grátis' },
  { value: 'DAILY', label: 'Diário' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'PREMIUM', label: 'Premium mensal' },
];

function statusColor(s: PrognosticStatus) {
  if (s === 'WON') return 'green';
  if (s === 'LOST') return 'red';
  return 'yellow';
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${y}-${m}-${day}T${h}:${min}`;
}

function fromDatetimeLocal(value: string) {
  const d = new Date(value);
  return d.toISOString();
}

function formatDisplayDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

const emptyForm = {
  homeTeam: '',
  awayTeam: '',
  prediction: '',
  odd: 1.5,
  matchDate: '',
  status: 'PENDING' as PrognosticStatus,
  plan: 'FREE' as PlanType,
  analysis: '',
};

export function AdminPrognosticos() {
  const [rows, setRows] = useState<AdminPrognostic[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpened, { open: openForm, close: closeForm }] = useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);
  const [editing, setEditing] = useState<AdminPrognostic | null>(null);
  const [deleting, setDeleting] = useState<AdminPrognostic | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listAdminPrognostics()
      .then(setRows)
      .catch((e) => {
        notifications.show({
          color: 'red',
          title: 'Erro',
          message: e instanceof Error ? e.message : 'Não foi possível carregar os prognósticos.',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localDefault = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    setForm({ ...emptyForm, matchDate: localDefault });
    openForm();
  };

  const openEdit = (row: AdminPrognostic) => {
    setEditing(row);
    setForm({
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      prediction: row.prediction,
      odd: row.odd,
      matchDate: toDatetimeLocal(row.matchDate),
      status: row.status,
      plan: row.plan,
      analysis: row.analysis ?? '',
    });
    openForm();
  };

  const submitForm = async () => {
    if (!form.homeTeam.trim() || !form.awayTeam.trim() || !form.prediction.trim()) {
      notifications.show({ color: 'yellow', message: 'Preencha times e palpite.' });
      return;
    }
    if (!form.matchDate) {
      notifications.show({ color: 'yellow', message: 'Informe data e hora do jogo.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        homeTeam: form.homeTeam.trim(),
        awayTeam: form.awayTeam.trim(),
        prediction: form.prediction.trim(),
        odd: form.odd,
        matchDate: fromDatetimeLocal(form.matchDate),
        status: form.status,
        plan: form.plan,
        analysis: form.analysis.trim() || null,
      };
      if (editing) {
        await updateAdminPrognostic(editing.id, payload);
        notifications.show({ color: 'green', message: 'Prognóstico atualizado.' });
      } else {
        await createAdminPrognostic(payload);
        notifications.show({ color: 'green', message: 'Prognóstico criado.' });
      }
      closeForm();
      load();
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Erro ao salvar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    try {
      await deleteAdminPrognostic(deleting.id);
      notifications.show({ color: 'green', message: 'Prognóstico removido.' });
      closeDelete();
      setDeleting(null);
      load();
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Erro ao excluir.',
      });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <Group justify="space-between" mb="md" wrap="wrap">
        <div>
          <Text fw={600} size="lg">
            Prognósticos
          </Text>
          <Text size="sm" c="dimmed">
            CRUD completo — visível só para administradores
          </Text>
        </div>
        <Group gap="xs">
          <Button variant="light" size="xs" onClick={load} loading={loading}>
            Atualizar
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Novo prognóstico
          </Button>
        </Group>
      </Group>

      <ScrollArea type="scroll" offsetScrollbars>
        <Table striped highlightOnHover withTableBorder miw={900}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Jogo</Table.Th>
              <Table.Th>Palpite</Table.Th>
              <Table.Th>Odd</Table.Th>
              <Table.Th>Data jogo</Table.Th>
              <Table.Th>Plano</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th w={120}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 && !loading ? (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" py="md" ta="center">
                    Nenhum prognóstico cadastrado.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {r.homeTeam} <Text span c="dimmed">x</Text> {r.awayTeam}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2} maw={220}>
                      {r.prediction}
                    </Text>
                  </Table.Td>
                  <Table.Td>{r.odd}</Table.Td>
                  <Table.Td>
                    <Text size="xs">{formatDisplayDate(r.matchDate)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="green" size="sm">
                      {r.plan}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(r.status)} variant="light" size="sm">
                      {statusOptions.find((o) => o.value === r.status)?.label ?? r.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Tooltip label="Editar">
                        <ActionIcon variant="light" color="blue" onClick={() => openEdit(r)}>
                          <IconPencil size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Excluir">
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={() => {
                            setDeleting(r);
                            openDelete();
                          }}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>

      <Modal
        opened={formOpened}
        onClose={closeForm}
        title={editing ? 'Editar prognóstico' : 'Novo prognóstico'}
        size="lg"
        centered
      >
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="Time mandante"
              value={form.homeTeam}
              onChange={(e) => setForm((f) => ({ ...f, homeTeam: e.currentTarget.value }))}
              required
            />
            <TextInput
              label="Time visitante"
              value={form.awayTeam}
              onChange={(e) => setForm((f) => ({ ...f, awayTeam: e.currentTarget.value }))}
              required
            />
          </Group>
          <TextInput
            label="Tipo de palpite / mercado"
            description="Ex.: vitória mandante, ambas marcam, +2.5 gols"
            value={form.prediction}
            onChange={(e) => setForm((f) => ({ ...f, prediction: e.currentTarget.value }))}
            required
          />
          <Group grow>
            <NumberInput
              label="Odd"
              value={form.odd}
              onChange={(v) => setForm((f) => ({ ...f, odd: typeof v === 'number' ? v : f.odd }))}
              min={1.01}
              step={0.05}
              decimalScale={2}
              fixedDecimalScale
            />
            <TextInput
              label="Data e hora do jogo"
              type="datetime-local"
              value={form.matchDate}
              onChange={(e) => setForm((f) => ({ ...f, matchDate: e.currentTarget.value }))}
              required
            />
          </Group>
          <Group grow>
            <Select
              label="Plano mínimo"
              data={planOptions}
              value={form.plan}
              onChange={(v) => setForm((f) => ({ ...f, plan: (v as PlanType) || 'FREE' }))}
            />
            <Select
              label="Status"
              data={statusOptions}
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: (v as PrognosticStatus) || 'PENDING' }))}
            />
          </Group>
          <Textarea
            label="Análise (opcional)"
            placeholder="Texto livre para justificar o palpite"
            value={form.analysis}
            onChange={(e) => setForm((f) => ({ ...f, analysis: e.currentTarget.value }))}
            minRows={3}
            autosize
            maxRows={8}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={closeForm}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={submitForm}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={deleteOpened}
        onClose={() => {
          closeDelete();
          setDeleting(null);
        }}
        title="Excluir prognóstico"
        centered
      >
        <Text size="sm" mb="lg">
          Tem certeza que deseja excluir{' '}
          <strong>
            {deleting?.homeTeam} x {deleting?.awayTeam}
          </strong>
          ? Esta ação não pode ser desfeita.
        </Text>
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={() => {
              closeDelete();
              setDeleting(null);
            }}
          >
            Cancelar
          </Button>
          <Button color="red" loading={removing} onClick={confirmDelete}>
            Excluir
          </Button>
        </Group>
      </Modal>
    </>
  );
}
