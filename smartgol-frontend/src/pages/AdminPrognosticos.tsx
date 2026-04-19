import { useCallback, useEffect, useState } from 'react';
import {
  Table,
  Button,
  Badge,
  Modal,
  Select,
  SegmentedControl,
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

const paidMinPlanOptions: { value: 'DAILY' | 'WEEKLY' | 'PREMIUM'; label: string }[] = [
  { value: 'DAILY', label: 'Mínimo: Diário' },
  { value: 'WEEKLY', label: 'Mínimo: Semanal' },
  { value: 'PREMIUM', label: 'Mínimo: Premium mensal' },
];

function planBadgeLabel(plan: PlanType): string {
  if (plan === 'FREE') return 'Grátis (todos)';
  if (plan === 'DAILY') return 'Pago · Diário+';
  if (plan === 'WEEKLY') return 'Pago · Semanal+';
  if (plan === 'PREMIUM' || plan === 'MONTHLY') return 'Pago · Premium+';
  return plan;
}

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
  /** Percentagem 0–100; null = não informar (API grava null). */
  probabilityPct: null as number | null,
  matchDate: '',
  status: 'PENDING' as PrognosticStatus,
  visibility: 'FREE' as 'FREE' | 'PAID',
  paidMinPlan: 'DAILY' as 'DAILY' | 'WEEKLY' | 'PREMIUM',
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
    const isFree = row.plan === 'FREE';
    const paidPlan: 'DAILY' | 'WEEKLY' | 'PREMIUM' =
      row.plan === 'WEEKLY'
        ? 'WEEKLY'
        : row.plan === 'PREMIUM' || row.plan === 'MONTHLY'
          ? 'PREMIUM'
          : 'DAILY';
    const p = row.probability;
    const probabilityPct =
      p != null && Number.isFinite(Number(p)) ? Math.round(Number(p) * 1000) / 10 : null;
    setForm({
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      prediction: row.prediction,
      odd: Number(row.odd) > 0 ? Number(row.odd) : 1.5,
      probabilityPct,
      matchDate: toDatetimeLocal(row.matchDate),
      status: row.status,
      visibility: isFree ? 'FREE' : 'PAID',
      paidMinPlan: isFree ? 'DAILY' : paidPlan,
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
      const plan: PlanType =
        form.visibility === 'FREE' ? 'FREE' : form.paidMinPlan;
      const probability =
        form.probabilityPct != null && Number.isFinite(form.probabilityPct)
          ? Math.min(100, Math.max(0, form.probabilityPct)) / 100
          : null;
      const payload = {
        homeTeam: form.homeTeam.trim(),
        awayTeam: form.awayTeam.trim(),
        prediction: form.prediction.trim(),
        odd: typeof form.odd === 'number' && Number.isFinite(form.odd) ? form.odd : 1.5,
        probability,
        matchDate: fromDatetimeLocal(form.matchDate),
        status: form.status,
        plan,
        analysis: form.analysis.trim() || null,
      };
      if (editing) {
        await updateAdminPrognostic(editing.id, payload);
        notifications.show({ color: 'green', message: 'Prognóstico atualizado.' });
      } else {
        await createAdminPrognostic(payload);
        notifications.show({ color: 'green', message: 'Prognóstico criado.' });
      }
      await load();
      closeForm();
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
        <Table striped highlightOnHover withTableBorder miw={980}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Jogo</Table.Th>
              <Table.Th>Palpite</Table.Th>
              <Table.Th>% jogo</Table.Th>
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
                <Table.Td colSpan={8}>
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
                  <Table.Td>
                    <Text size="xs">
                      {r.probability != null && Number.isFinite(Number(r.probability))
                        ? `${(Number(r.probability) * 100).toFixed(0)}%`
                        : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>{r.odd}</Table.Td>
                  <Table.Td>
                    <Text size="xs">{formatDisplayDate(r.matchDate)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={r.plan === 'FREE' ? 'green' : 'violet'} size="sm">
                      {planBadgeLabel(r.plan)}
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
              label="Percentagem do jogo"
              description="Opcional. Confiança ou probabilidade que você atribui a este palpite (0 a 100)."
              placeholder="Ex.: 62"
              suffix="%"
              value={form.probabilityPct ?? ''}
              onChange={(v) =>
                setForm((f) => {
                  if (v === '' || v === null) return { ...f, probabilityPct: null };
                  if (typeof v === 'number' && Number.isFinite(v)) return { ...f, probabilityPct: v };
                  return f;
                })
              }
              min={0}
              max={100}
              step={0.5}
              decimalScale={1}
            />
            <NumberInput
              label="Odd (cotação)"
              description="Ex.: 1,85 para o mercado escolhido"
              value={form.odd}
              onChange={(v) =>
                setForm((f) => {
                  if (typeof v === 'number' && Number.isFinite(v)) return { ...f, odd: v };
                  const parsed = parseFloat(String(v ?? '').replace(',', '.'));
                  if (Number.isFinite(parsed) && parsed >= 1.01) return { ...f, odd: parsed };
                  return f;
                })
              }
              min={1.01}
              step={0.05}
              decimalScale={2}
              fixedDecimalScale
            />
          </Group>
          <TextInput
            label="Data e hora do jogo"
            type="datetime-local"
            value={form.matchDate}
            onChange={(e) => setForm((f) => ({ ...f, matchDate: e.currentTarget.value }))}
            required
          />
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Quem vê este palpite
            </Text>
            <SegmentedControl
              value={form.visibility}
              onChange={(v) =>
                setForm((f) => ({ ...f, visibility: v as 'FREE' | 'PAID' }))
              }
              data={[
                {
                  value: 'FREE',
                  label: 'Grátis — todos (página Prognósticos)',
                },
                {
                  value: 'PAID',
                  label: 'Pago — só assinantes (Área Premium)',
                },
              ]}
              fullWidth
            />
            <Text size="xs" c="dimmed">
              Grátis não aparece na Área Premium. Pago não aparece na lista pública grátis; só quem tem o plano
              indicado (ou superior) vê na Área Premium.
            </Text>
            {form.visibility === 'PAID' && (
              <Select
                label="Plano mínimo (assinatura)"
                data={paidMinPlanOptions}
                value={form.paidMinPlan}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    paidMinPlan: (v as 'DAILY' | 'WEEKLY' | 'PREMIUM') || 'DAILY',
                  }))
                }
              />
            )}
          </Stack>
          <Select
            label="Status"
            data={statusOptions}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: (v as PrognosticStatus) || 'PENDING' }))}
          />
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
