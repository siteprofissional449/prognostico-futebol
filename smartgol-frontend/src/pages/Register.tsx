import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TextInput, PasswordInput, Button, Paper, Title, Text, Stack } from '@mantine/core';
import { useAuth } from '../contexts/AuthContext';
import { notifications } from '@mantine/notifications';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      notifications.show({
        color: 'yellow',
        message: 'As senhas não conferem.',
      });
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      notifications.show({ color: 'green', message: 'Conta criada! Bem-vindo.' });
      navigate('/');
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : 'Erro ao cadastrar.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', padding: '0 1rem' }}>
      <Paper p="xl" radius="md" withBorder>
        <Title order={2} mb="md">Cadastro</Title>
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
            <PasswordInput
              label="Confirmar senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              error={
                confirmPassword.length > 0 && password !== confirmPassword
                  ? 'As senhas não conferem'
                  : undefined
              }
            />
            <Button type="submit" loading={loading} fullWidth>Criar conta</Button>
          </Stack>
        </form>
        <Text size="sm" c="dimmed" mt="md">
          Já tem conta? <Link to="/login">Entrar</Link>
        </Text>
      </Paper>
    </div>
  );
}
