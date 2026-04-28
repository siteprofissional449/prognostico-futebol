import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
} from 'react';
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

function readImageFromClipboard(
  event: ClipboardEvent<HTMLElement>,
  onDone: (dataUrl: string) => void,
): boolean {
  const items = event.clipboardData?.items;
  if (!items?.length) return false;

  for (const item of Array.from(items)) {
    if (!item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (!file) continue;
    event.preventDefault();
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (result.startsWith('data:image/')) onDone(result);
    };
    reader.readAsDataURL(file);
    return true;
  }
  return false;
}

function readImageFileAsDataUrl(file: File, onDone: (dataUrl: string) => void): void {
  if (!file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : '';
    if (result.startsWith('data:image/')) onDone(result);
  };
  reader.readAsDataURL(file);
}

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const onPasteImage = useCallback((event: ClipboardEvent<HTMLElement>) => {
    const ok = readImageFromClipboard(event, (dataUrl) => {
      setImageUrl(dataUrl);
      notifications.show({
        color: 'green',
        title: 'Imagem colada',
        message: 'A imagem foi convertida para uso direto no banner.',
      });
    });
    if (!ok) {
      notifications.show({
        color: 'yellow',
        title: 'Sem imagem no clipboard',
        message: 'Copie uma imagem e cole aqui (Ctrl+V).',
      });
    }
  }, []);

  const onPickImageFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    readImageFileAsDataUrl(file, (dataUrl) => {
      setImageUrl(dataUrl);
      notifications.show({
        color: 'green',
        title: 'Imagem selecionada',
        message: 'Arquivo convertido para uso direto no banner.',
      });
    });
    event.currentTarget.value = '';
  }, []);

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
            label="Imagem (URL https://... ou data:image...)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.currentTarget.value)}
          />
          <Paper
            p="xs"
            withBorder
            onPaste={onPasteImage}
            tabIndex={0}
            style={{ cursor: 'text' }}
          >
            <Text size="sm">
              Cole imagem direta aqui com <strong>Ctrl+V</strong> (ou mantenha a URL no campo acima).
            </Text>
          </Paper>
          <Group>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickImageFile}
              style={{ display: 'none' }}
            />
            <Button size="xs" variant="light" onClick={() => fileInputRef.current?.click()}>
              Selecionar arquivo de imagem
            </Button>
          </Group>
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
  const newFileInputRef = useRef<HTMLInputElement | null>(null);

  const onPasteNewImage = useCallback((event: ClipboardEvent<HTMLElement>) => {
    const ok = readImageFromClipboard(event, (dataUrl) => {
      setNImg(dataUrl);
      notifications.show({
        color: 'green',
        title: 'Imagem colada',
        message: 'Pronto, agora é só preencher o link e adicionar.',
      });
    });
    if (!ok) {
      notifications.show({
        color: 'yellow',
        title: 'Sem imagem no clipboard',
        message: 'Copie uma imagem e cole aqui (Ctrl+V).',
      });
    }
  }, []);

  const onPickNewImageFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    readImageFileAsDataUrl(file, (dataUrl) => {
      setNImg(dataUrl);
      notifications.show({
        color: 'green',
        title: 'Imagem selecionada',
        message: 'Pronto, agora é só preencher o link e adicionar.',
      });
    });
    event.currentTarget.value = '';
  }, []);

  const create = async () => {
    const imageUrl = nImg.trim();
    const linkUrl = nLink.trim();
    if (!imageUrl || !linkUrl) {
      notifications.show({
        color: 'yellow',
        title: 'Preencha',
        message: 'Imagem (URL ou colada) e URL do destino são obrigatórios.',
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
          Pode usar URL da imagem (https://), colar imagem com Ctrl+V ou selecionar arquivo.
        </Text>
      </div>

      <Divider label="Novo comercial" labelPosition="center" />

      <Paper p="md" radius="md" withBorder>
        <Stack gap="sm">
          <TextInput label="Título (opcional)" value={nTitle} onChange={(e) => setNTitle(e.currentTarget.value)} />
          <TextInput
            label="Imagem (URL https://... ou colada)"
            placeholder="https://... ou cole imagem no bloco abaixo"
            value={nImg}
            onChange={(e) => setNImg(e.currentTarget.value)}
          />
          <Paper
            p="xs"
            withBorder
            onPaste={onPasteNewImage}
            tabIndex={0}
            style={{ cursor: 'text' }}
          >
            <Text size="sm">
              Clique aqui e cole uma imagem com <strong>Ctrl+V</strong>.
            </Text>
          </Paper>
          <Group>
            <input
              ref={newFileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickNewImageFile}
              style={{ display: 'none' }}
            />
            <Button size="xs" variant="light" onClick={() => newFileInputRef.current?.click()}>
              Selecionar arquivo de imagem
            </Button>
          </Group>
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
