import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Paper,
  List,
  ThemeIcon,
  Group,
  Button,
  Loader,
  Alert,
  TextInput,
  Stack,
  Badge,
  Divider,
} from '@mantine/core';
import {
  IconCheck,
  IconSparkles,
  IconLock,
  IconTrendingUp,
  IconChartDots,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../contexts/AuthContext';
import { getPlans } from '../api/plans';
import { getPremiumPrognostics } from '../api/premium';
import { PremiumPrognosticCard } from '../components/PremiumPrognosticCard';
import type { AdminPrognostic, Plan } from '../types';
function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysLocal(base: Date, delta: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}

export function Premium() {
  const { isLoggedIn, plan } = useAuth();
  const isSubscriber = isLoggedIn && (plan === 'PREMIUM' || plan === 'VIP');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [list, setList] = useState<AdminPrognostic[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => localYMD(addDaysLocal(today, -7)));
  const [to, setTo] = useState(() => localYMD(addDaysLocal(today, 30)));

  const loadPrognostics = useCallback(() => {
    if (!isSubscriber) return;
    setLoading(true);
    setError(null);
    getPremiumPrognostics({ from, to })
      .then(setList)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Não foi possível carregar.';
        setError(msg);
        notifications.show({ color: 'red', title: 'Erro', message: msg });
      })
      .finally(() => setLoading(false));
  }, [isSubscriber, from, to]);

  useEffect(() => {
    if (isSubscriber) loadPrognostics();
  }, [isSubscriber, loadPrognostics]);

  useEffect(() => {
    if (isSubscriber) return;
    getPlans()
      .then(setPlans)
      .catch(() => setPlans([]));
  }, [isSubscriber]);

  const stats = useMemo(() => {
    let p = 0;
    let w = 0;
    let l = 0;
    for (const x of list) {
      if (x.status === 'PENDING') p += 1;
      else if (x.status === 'WON') w += 1;
      else if (x.status === 'LOST') l += 1;
    }
    return { p, w, l, total: list.length };
  }, [list]);

  const paidPlans = plans.filter((pl) => pl.code === 'PREMIUM' || pl.code === 'VIP');

  return (
    <Container size="lg" py="xl">
      <Group justify="space-between" align="flex-start" wrap="wrap" mb="xl" gap="md">
        <div>
          <Group gap="sm" mb="xs">
            <ThemeIcon size="lg" radius="md" variant="gradient" gradient={{ from: 'green.6', to: 'teal.5' }}>
              <IconSparkles size={22} />
            </ThemeIcon>
            <Title order={1}>Área Premium</Title>
          </Group>
          <Text c="dimmed" maw={560}>
            Conteúdo curado: palpites com odd, análise e acompanhamento de resultado — alinhado ao seu plano
            (Premium ou VIP).
          </Text>
        </div>
        {isSubscriber && plan && (
          <Badge size="lg" variant="light" color={plan === 'VIP' ? 'yellow' : 'blue'}>
            Plano ativo: {plan === 'VIP' ? 'VIP' : 'Premium'}
          </Badge>
        )}
      </Group>

      {!isLoggedIn && (
        <Paper p="xl" radius="md" withBorder mb="xl">
          <Group align="flex-start" wrap="wrap" gap="lg">
            <ThemeIcon size={48} radius="md" color="gray" variant="light">
              <IconLock size={26} />
            </ThemeIcon>
            <div style={{ flex: 1, minWidth: 240 }}>
              <Title order={3} mb="sm">
                Acesso para assinantes
              </Title>
              <Text c="dimmed" size="sm" mb="md">
                Entre com sua conta Premium ou VIP para ver os prognósticos exclusivos cadastrados pela equipe.
              </Text>
              <Group gap="sm">
                <Button component={Link} to="/login" state={{ from: '/premium' }}>
                  Entrar
                </Button>
                <Button component={Link} to="/register" variant="light">
                  Criar conta
                </Button>
              </Group>
            </div>
          </Group>
        </Paper>
      )}

      {isLoggedIn && !isSubscriber && (
        <>
          <Alert color="yellow" variant="light" mb="xl" title="Plano Grátis">
            Você está no plano grátis. Faça upgrade para desbloquear a área Premium com palpites curatorados e
            análises.
          </Alert>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="xl">
            {paidPlans.map((pl) => (
              <Paper key={pl.id} p="lg" radius="md" withBorder>
                <Text fw={700} size="lg" mb={4}>
                  {pl.name}
                </Text>
                <Text size="sm" c="dimmed" mb="md">
                  Código: {pl.code}
                </Text>
                <Text size="xl" fw={800} c="green.4" mb="md">
                  R$ {Number(pl.price).toFixed(2)}
                  <Text span size="sm" c="dimmed" fw={400}>
                    {pl.billingPeriod === 'WEEKLY'
                      ? ' / semana (renova a cada 7 dias)'
                      : ' / mês'}
                  </Text>
                </Text>
                {pl.billingPeriod === 'WEEKLY' && pl.code === 'PREMIUM' && (
                  <Text size="xs" c="dimmed" mb="sm">
                    Cada ciclo cobre 7 dias de acesso Premium; ao vencer a data no sistema, é preciso renovar
                    (pagamento ou liberação pelo admin).
                  </Text>
                )}
                <Text size="xs" c="dimmed">
                  Contratação e pagamento podem ser configurados com o administrador (área admin: gestão de
                  planos do usuário).
                </Text>
              </Paper>
            ))}
          </SimpleGrid>
        </>
      )}

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mb="xl">
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon color="green" variant="light" size="lg" radius="md">
              <IconTrendingUp size={20} />
            </ThemeIcon>
            <Title order={4}>O que você ganha</Title>
          </Group>
          <List
            spacing="sm"
            size="sm"
            icon={
              <ThemeIcon color="green" variant="transparent" size={22} radius="xl">
                <IconCheck size={14} />
              </ThemeIcon>
            }
          >
            <List.Item>Palpites selecionados com odd e texto de análise</List.Item>
            <List.Item>Filtro por intervalo de datas dos jogos</List.Item>
            <List.Item>Indicadores de resultado (pendente / green / red)</List.Item>
            <List.Item>VIP inclui entradas marcadas só para VIP no painel admin</List.Item>
          </List>
        </Paper>
        <Paper p="lg" radius="md" withBorder>
          <Group gap="sm" mb="md">
            <ThemeIcon color="teal" variant="light" size="lg" radius="md">
              <IconChartDots size={20} />
            </ThemeIcon>
            <Title order={4}>Resumo rápido</Title>
          </Group>
          {isSubscriber ? (
            <Text size="sm" c="dimmed">
              Os prognósticos listados abaixo são os cadastrados em <strong>Admin → Prognósticos</strong>, filtrados
              automaticamente pelo seu plano. Premium não vê itens exclusivos de VIP.
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              Após a assinatura, a lista atualiza em tempo real conforme novos jogos forem publicados pela equipe.
            </Text>
          )}
        </Paper>
      </SimpleGrid>

      {isSubscriber && (
        <>
          <Divider my="xl" label="Seus prognósticos" labelPosition="center" />
          <Paper p="md" radius="md" withBorder mb="lg">
            <Stack gap="md">
              <Group grow align="flex-end" wrap="wrap">
                <TextInput
                  label="De (data do jogo)"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.currentTarget.value)}
                />
                <TextInput
                  label="Até"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.currentTarget.value)}
                />
                <Button onClick={loadPrognostics} loading={loading} mt={{ base: 0, sm: 24 }}>
                  Aplicar filtro
                </Button>
              </Group>
              <Group gap="md">
                <Badge size="lg" variant="light" color="yellow">
                  Pendentes: {stats.p}
                </Badge>
                <Badge size="lg" variant="light" color="green">
                  Greens: {stats.w}
                </Badge>
                <Badge size="lg" variant="light" color="red">
                  Reds: {stats.l}
                </Badge>
                <Badge size="lg" variant="outline" color="gray">
                  Total: {stats.total}
                </Badge>
              </Group>
            </Stack>
          </Paper>

          {error && (
            <Alert color="red" mb="md" title="Erro ao carregar">
              {error}
            </Alert>
          )}

          {loading && list.length === 0 ? (
            <Loader size="lg" mx="auto" my="xl" />
          ) : list.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              Nenhum prognóstico no período. Ajuste as datas ou peça ao admin para publicar novas entradas.
            </Text>
          ) : (
            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              {list.map((row) => (
                <PremiumPrognosticCard key={row.id} row={row} />
              ))}
            </SimpleGrid>
          )}
        </>
      )}
    </Container>
  );
}
