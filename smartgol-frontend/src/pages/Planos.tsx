import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { IconCheck, IconCreditCard, IconRocket } from '@tabler/icons-react';
import { getPlans } from '../api/plans';
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

export function Planos() {
  const { isLoggedIn } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    getPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg" mb="xl">
        <div>
          <Title order={1} mb="xs">
            Planos de membros
          </Title>
          <Text c="dimmed" maw={640}>
            Grátis, diário, semanal e premium mensal. Os preços vêm da API; o checkout será ligado ao campo{' '}
            <code>paymentPriceId</code> (Stripe, Mercado Pago, etc.).
          </Text>
        </div>
        <Alert variant="light" color="teal" title="Pagamento" icon={<IconCreditCard size={18} />}>
          Botões de compra ficam desativados até você configurar o gateway e preencher{' '}
          <strong>paymentProvider</strong> e <strong>paymentPriceId</strong> no banco ou via admin futuro.
        </Alert>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {plans.map((pl) => {
          const isFree = pl.code === 'FREE' || Number(pl.price) === 0;
          const readyForPayment = !!(pl.paymentPriceId && pl.paymentProvider);
          return (
            <Paper key={pl.id} p="lg" radius="md" withBorder shadow="sm">
              <Group justify="space-between" mb="xs">
                <Text fw={700} size="lg">
                  {pl.name}
                </Text>
                <Badge variant="light" color={isFree ? 'gray' : 'green'}>
                  {pl.code}
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
                  Ciclo: <strong>{pl.billingPeriod}</strong>
                </List.Item>
                {!isFree && (
                  <>
                    <List.Item>
                      Gateway: {pl.paymentProvider || '— (definir depois)'}
                    </List.Item>
                    <List.Item>
                      ID no gateway: {pl.paymentPriceId || '— (definir depois)'}
                    </List.Item>
                  </>
                )}
              </List>
              {isFree ? (
                <Button component={Link} to="/register" variant="light" fullWidth>
                  Criar conta grátis
                </Button>
              ) : (
                <Button
                  fullWidth
                  leftSection={<IconRocket size={16} />}
                  disabled={!readyForPayment}
                  title={
                    readyForPayment
                      ? 'Checkout será ativado na integração'
                      : 'Configure paymentPriceId e paymentProvider na API'
                  }
                >
                  {readyForPayment ? 'Assinar (em breve)' : 'Pagamento em configuração'}
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
