import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { TextInput, PasswordInput, Button, Paper, Title, Text, Stack } from '@mantine/core';
import { useAuth } from '../contexts/AuthContext';
import { notifications } from '@mantine/notifications';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { isAdmin: admin } = await login(email, password);
      notifications.show({ color: 'green', message: 'Login realizado!' });
      if (from) navigate(from);
      else if (admin) navigate('/admin');
      else navigate('/');
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'Erro ao entrar.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: '0 1rem' }}>
      <Paper p="xl" radius="md" withBorder>
        <Title order={2} mb="md">Entrar</Title>
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
            <PasswordInput
              label="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
            <Button type="submit" loading={loading} fullWidth>Entrar</Button>
          </Stack>
        </form>
        <Text size="sm" c="dimmed" mt="md">
          Não tem conta? <Link to="/register">Cadastre-se</Link>
        </Text>
      </Paper>
    </div>
  );
}
