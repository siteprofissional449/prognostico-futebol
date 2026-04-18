import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Paper,
  List,
  ThemeIcon,
  Button,
  Badge,
  Stack,
  Alert,
  Group,
} from '@mantine/core';
import { IconCheck, IconCreditCard } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { getPlans } from '../api/plans';
import { mercadoPagoCheckout } from '../api/payments';
import type { Plan } from '../types';
import { useAuth } from '../contexts/AuthContext';

function billingLabel(p: Plan): string {
  switch (p.billingPeriod) {
    case 'NONE':
      return '';
    case 'DAILY':
      return ' / dia';
    case 'WEEKLY':
      return ' / semana';
    case 'MONTHLY':
      return ' / mês';
    default:
      return '';
  }
}

function periodLabel(period: Plan['billingPeriod']): string {
  switch (period) {
    case 'DAILY':
      return 'Diário';
    case 'WEEKLY':
      return 'Semanal';
    case 'MONTHLY':
      return 'Mensal';
    default:
      return 'Sem renovação';
  }
}

export function Planos() {
  const { isLoggedIn } = useAuth();
  const [searchParams] = useSearchParams();
  const mpStatus = searchParams.get('mp');

  const [plans, setPlans] = useState<Plan[]>([]);
  const [payingCode, setPayingCode] = useState<string | null>(null);

  useEffect(() => {
    getPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg" mb="xl">
        <div>
          <Title order={1} mb="xs">
            Escolha seu plano
          </Title>
          <Text c="dimmed" maw={640}>
            Assine em poucos cliques com checkout seguro e liberação automática do acesso.
          </Text>
        </div>

        {mpStatus === 'success' && (
          <Alert color="green" title="Pagamento aprovado">
            Se o webhook estiver configurado, seu plano será liberado em instantes. Faça login de novo se o menu
            não atualizar.
          </Alert>
        )}
        {mpStatus === 'pending' && (
          <Alert color="yellow" title="Pagamento pendente">
            Aguardando confirmação do Mercado Pago. Você receberá o acesso quando for aprovado.
          </Alert>
        )}
        {mpStatus === 'failure' && (
          <Alert color="red" title="Pagamento não concluído">
            Tente novamente ou use outro meio de pagamento.
          </Alert>
        )}

        <Alert variant="light" color="blue" title="Pagamento seguro" icon={<IconCreditCard size={18} />}>
          O pagamento é processado pelo Mercado Pago.
        </Alert>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {plans.map((pl) => {
          const isFree = pl.code === 'FREE' || Number(pl.price) === 0;
          const paidCode = pl.code as 'DAILY' | 'WEEKLY' | 'MONTHLY';
          const canMp =
            !isFree && ['DAILY', 'WEEKLY', 'MONTHLY'].includes(pl.code);

          return (
            <Paper key={pl.id} p="lg" radius="md" withBorder shadow="sm">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="lg">
                  {pl.name}
                </Text>
                <Badge variant="light" color={isFree ? 'gray' : 'green'}>
                  {isFree ? 'Grátis' : 'Pago'}
                </Badge>
              </Group>
              {pl.description && (
                <Text size="sm" c="dimmed" mb="md">
                  {pl.description}
                </Text>
              )}
              <Text size="xl" fw={800} c={isFree ? 'dimmed' : 'green.4'} mb="md">
                {isFree ? 'R$ 0,00' : `R$ ${Number(pl.price).toFixed(2)}`}
                {!isFree && (
                  <Text span size="sm" c="dimmed" fw={400}>
                    {billingLabel(pl)}
                  </Text>
                )}
              </Text>
              <List
                size="sm"
                spacing={6}
                mb="md"
                icon={
                  <ThemeIcon size={20} radius="xl" variant="transparent" color="green">
                    <IconCheck size={12} />
                  </ThemeIcon>
                }
              >
                <List.Item>
                  Ciclo: <strong>{periodLabel(pl.billingPeriod)}</strong>
                </List.Item>
              </List>
              {isFree ? (
                <Button component={Link} to="/register" variant="light" fullWidth>
                  Criar conta grátis
                </Button>
              ) : !isLoggedIn ? (
                <Button component={Link} to="/login" state={{ from: '/planos' }} fullWidth variant="filled">
                  Entrar para assinar
                </Button>
              ) : (
                <Button
                  fullWidth
                  leftSection={<IconCreditCard size={18} />}
                  loading={payingCode === pl.code}
                  disabled={!canMp}
                  onClick={async () => {
                    setPayingCode(pl.code);
                    try {
                      const { url } = await mercadoPagoCheckout(paidCode);
                      window.location.href = url;
                    } catch (e) {
                      const msg =
                        e instanceof Error ? e.message : 'Não foi possível iniciar o checkout.';
                      notifications.show({ color: 'red', title: 'Mercado Pago', message: msg });
                      setPayingCode(null);
                    }
                  }}
                >
                  Pagar com Mercado Pago
                </Button>
              )}
            </Paper>
          );
        })}
      </SimpleGrid>

      {!isLoggedIn && (
        <Text ta="center" c="dimmed" mt="xl" size="sm">
          Já tem conta? <Link to="/login">Entrar</Link>
        </Text>
      )}
    </Container>
  );
}
