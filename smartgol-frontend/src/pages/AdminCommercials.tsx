import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Group,
  NumberInput,
  Paper,
  Stack,
  Switch,
  TextInput,
  Text,
  Divider,
  ActionIcon,
} from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { CommercialAdmin } from '../types';
import {
  adminCreateCommercial,
  adminDeleteCommercial,
  adminListCommercials,
  adminPatchCommercial,
} from '../api/commercials';

function CommercialEditor({
  row,
  onReload,
}: {
  row: CommercialAdmin;
  onReload: () => void;
}) {
  const [imageUrl, setImageUrl] = useState(row.imageUrl);
  const [linkUrl, setLinkUrl] = useState(row.linkUrl);
  const [title, setTitle] = useState(row.title ?? '');
  const [sortOrder, setSortOrder] = useState(row.sortOrder);
  const [active, setActive] = useState(row.active);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setImageUrl(row.imageUrl);
    setLinkUrl(row.linkUrl);
    setTitle(row.title ?? '');
    setSortOrder(row.sortOrder);
    setActive(row.active);
  }, [row.id, row.imageUrl, row.linkUrl, row.title, row.sortOrder, row.active]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await adminPatchCommercial(row.id, {
        imageUrl,
        linkUrl,
        title: title.trim() || null,
        sortOrder: Number(sortOrder) || 0,
        active,
      });
      notifications.show({ title: 'Guardado', message: '', color: 'green' });
      onReload();
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Erro',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }, [active, imageUrl, linkUrl, onReload, row.id, sortOrder, title]);

  const remove = useCallback(async () => {
    if (!window.confirm('Remover este comercial da rotação?')) return;
    try {
      await adminDeleteCommercial(row.id);
      notifications.show({
        title: 'Removido',
        message: '',
        color: 'green',
      });
      onReload();
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Erro',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }, [onReload, row.id]);

  return (
    <Paper p="md" radius="md" withBorder>
      <Group align="flex-start" wrap="wrap" gap="md">
        <div style={{ width: 160, flexShrink: 0 }}>
          <img
            src={imageUrl}
            alt=""
            style={{
              width: '100%',
              maxHeight: 90,
              objectFit: 'contain',
              borderRadius: 8,
              background: '#0b0f14',
            }}
            loading="lazy"
          />
        </div>
        <Stack gap="xs" style={{ flex: 1, minWidth: 220 }}>
          <TextInput
            label="Título (opcional, acessibilidade)"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <TextInput
            label="URL da imagem (https://…)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.currentTarget.value)}
          />
          <TextInput
            label="URL ao clicar (https://…)"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.currentTarget.value)}
          />
          <Group grow>
            <NumberInput
              label="Ordem"
              value={sortOrder}
              onChange={(v) => setSortOrder(typeof v === 'number' ? v : 0)}
              min={0}
            />
            <Stack gap={4} justify="flex-end" pb={4}>
              <Switch
                label="Ativo"
                checked={active}
                onChange={(e) => setActive(e.currentTarget.checked)}
              />
            </Stack>
          </Group>
          <Group justify="space-between">
            <Button size="sm" onClick={save} loading={saving}>
              Guardar
            </Button>
            <ActionIcon color="red" variant="light" onClick={remove} aria-label="Remover">
              <IconTrash size={18} />
            </ActionIcon>
          </Group>
        </Stack>
      </Group>
    </Paper>
  );
}

export function AdminCommercials() {
  const [rows, setRows] = useState<CommercialAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminListCommercials()
      .then((r) => setRows(Array.isArray(r) ? r : []))
      .catch((e) => {
        notifications.show({
          color: 'red',
          title: 'Erro ao carregar',
          message: e instanceof Error ? e.message : String(e),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const [nTitle, setNTitle] = useState('');
  const [nImg, setNImg] = useState('');
  const [nLink, setNLink] = useState('');
  const [nOrder, setNOrder] = useState<number | ''>('');
  const [nActive, setNActive] = useState(true);
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const imageUrl = nImg.trim();
    const linkUrl = nLink.trim();
    if (!imageUrl || !linkUrl) {
      notifications.show({
        color: 'yellow',
        title: 'Preencha',
        message: 'URL da imagem e URL do destino são obrigatórios.',
      });
      return;
    }
    setCreating(true);
    try {
      await adminCreateCommercial({
        imageUrl,
        linkUrl,
        title: nTitle.trim() || null,
        sortOrder: nOrder === '' ? undefined : Number(nOrder),
        active: nActive,
      });
      notifications.show({ title: 'Criado', message: '', color: 'green' });
      setNTitle('');
      setNImg('');
      setNLink('');
      setNOrder('');
      setNActive(true);
      load();
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Erro',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Stack gap="xl">
      <div>
        <Text size="sm" c="dimmed" mb={4}>
          Comerciais
        </Text>
        <Text size="lg" fw={600}>
          Imagens públicas aparecem abaixo do menu em todas as páginas — rodamos um de cada vez (carrossél).
          Use URLs que comecem por <strong>https://</strong> (pode hospedar a imagem no Imgur,
          Cloudinary, disco do site, etc.).
        </Text>
      </div>

      <Divider label="Novo comercial" labelPosition="center" />

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <TextInput label="Título (opcional)" value={nTitle} onChange={(e) => setNTitle(e.currentTarget.value)} />
          <TextInput
            label="URL da imagem"
            placeholder="https://..."
            value={nImg}
            onChange={(e) => setNImg(e.currentTarget.value)}
          />
          <TextInput
            label="URL do site do anunciante"
            placeholder="https://..."
            value={nLink}
            onChange={(e) => setNLink(e.currentTarget.value)}
          />
          <Group grow>
            <NumberInput
              label="Ordem (opcional, vazio = último)"
              placeholder="automático"
              value={nOrder}
              onChange={(v) => {
                if (v === '' || v === undefined) setNOrder('');
                else if (typeof v === 'number') setNOrder(v);
              }}
              min={0}
            />
            <Stack gap={6} pb={4} justify="flex-end">
              <Switch checked={nActive} onChange={(e) => setNActive(e.currentTarget.checked)} label="Ativo" />
            </Stack>
          </Group>
          <Button onClick={create} loading={creating}>
            Adicionar comercial
          </Button>
        </Stack>
      </Paper>

      <Divider label="Todos os comerciais" labelPosition="center" />

      {loading ? (
        <Text c="dimmed">Carregando…</Text>
      ) : rows.length === 0 ? (
        <Text c="dimmed">Nenhum comercial registado.</Text>
      ) : (
        rows.map((r) => <CommercialEditor key={r.id} row={r} onReload={load} />)
      )}
    </Stack>
  );
}
