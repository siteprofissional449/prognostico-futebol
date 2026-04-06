import { useCallback, useEffect, useState } from 'react';
import {
  Table,
  Button,
  Badge,
  Modal,
  Select,
  TextInput,
  Stack,
  Group,
  Text,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { getAdminUsers, patchAdminUser } from '../api/admin';
import type { AdminUserRow, PlanType } from '../types';

const planOptions: { value: PlanType; label: string }[] = [
  { value: 'FREE', label: 'Grátis' },
  { value: 'PREMIUM', label: 'Premium' },
  { value: 'VIP', label: 'VIP' },
];

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

export function AdminUsers() {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [planCode, setPlanCode] = useState<PlanType>('FREE');
  const [expiresInput, setExpiresInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getAdminUsers()
      .then(setRows)
      .catch((e) => {
        notifications.show({
          color: 'red',
          message: e instanceof Error ? e.message : 'Erro ao listar usuários',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (u: AdminUserRow) => {
    setEditUser(u);
    const code = (u.currentPlan?.code as PlanType) || 'FREE';
    setPlanCode(code === 'PREMIUM' || code === 'VIP' ? code : 'FREE');
    if (u.planExpiresAt) {
      const d = new Date(u.planExpiresAt);
      setExpiresInput(d.toISOString().slice(0, 10));
    } else {
      setExpiresInput('');
    }
    open();
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const body: { planCode: PlanType; planExpiresAt?: string | null } = {
        planCode,
      };
      if (planCode !== 'FREE') {
        body.planExpiresAt = expiresInput.trim()
          ? new Date(expiresInput + 'T23:59:59').toISOString()
          : null;
      }
      await patchAdminUser(editUser.id, body);
      notifications.show({ color: 'green', message: 'Usuário atualizado.' });
      close();
      load();
    } catch (e) {
      notifications.show({
        color: 'red',
        message: e instanceof Error ? e.message : 'Erro ao salvar',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Group justify="space-between" mb="md">
        <Text fw={600} size="lg">
          Usuários
        </Text>
        <Button variant="light" size="xs" onClick={load} loading={loading}>
          Atualizar
        </Button>
      </Group>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>E-mail</Table.Th>
            <Table.Th>Plano</Table.Th>
            <Table.Th>Expira</Table.Th>
            <Table.Th>Admin</Table.Th>
            <Table.Th>Cadastro</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((u) => (
            <Table.Tr key={u.id}>
              <Table.Td>{u.email}</Table.Td>
              <Table.Td>
                <Badge variant="light" color="green">
                  {u.currentPlan?.code ?? 'FREE'}
                </Badge>
              </Table.Td>
              <Table.Td>{formatDate(u.planExpiresAt)}</Table.Td>
              <Table.Td>
                {u.isAdmin ? (
                  <Badge color="violet">Sim</Badge>
                ) : (
                  <Text size="sm" c="dimmed">
                    Não
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{formatDate(u.createdAt)}</Table.Td>
              <Table.Td>
                <Button size="xs" variant="light" onClick={() => openEdit(u)}>
                  Editar plano
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={close} title="Plano do usuário" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {editUser?.email}
          </Text>
          <Select
            label="Plano"
            data={planOptions}
            value={planCode}
            onChange={(v) => setPlanCode((v as PlanType) || 'FREE')}
          />
          {planCode === 'PREMIUM' && (
            <Text size="xs" c="dimmed">
              Premium: referência de cobrança <strong>R$ 9,99 a cada 7 dias</strong>. Use a validade como fim do
              período pago (ex.: uma semana após o pagamento).
            </Text>
          )}
          {planCode !== 'FREE' && (
            <>
              <TextInput
                label="Validade (opcional)"
                description={
                  planCode === 'PREMIUM'
                    ? 'Recomendado para Premium: data em que o ciclo de 7 dias termina'
                    : 'Data final de acesso ao plano pago'
                }
                type="date"
                value={expiresInput}
                onChange={(e) => setExpiresInput(e.currentTarget.value)}
              />
              {planCode === 'PREMIUM' && (
                <Button
                  type="button"
                  variant="light"
                  size="xs"
                  w="fit-content"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 7);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    setExpiresInput(`${y}-${m}-${day}`);
                  }}
                >
                  Definir validade para +7 dias (hoje)
                </Button>
              )}
            </>
          )}
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={close}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={handleSave}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
