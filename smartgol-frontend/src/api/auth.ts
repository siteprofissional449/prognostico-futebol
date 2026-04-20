import { api } from './client';
import type { AuthSession, LoginResponse } from '../types';

export async function login(email: string, password: string): Promise<LoginResponse> {
  return api<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string): Promise<{ id: string; email: string }> {
  return api<{ id: string; email: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getSession(): Promise<AuthSession> {
  return api<AuthSession>('/auth/me', { method: 'GET' });
}
