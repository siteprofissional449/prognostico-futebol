import { api } from './client';
import type { AdminStats, AdminUserRow, PlanType } from '../types';

export function getAdminStats() {
  return api<AdminStats>('/admin/stats');
}

export function getAdminUsers() {
  return api<AdminUserRow[]>('/admin/users');
}

export function patchAdminUser(
  userId: string,
  body: { planCode?: PlanType; planExpiresAt?: string | null },
) {
  return api<AdminUserRow>(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** Gera prognósticos (IA + API futebol). Requer JWT de administrador. */
export function adminGeneratePredictions(date?: string) {
  const q = date?.trim() ? `?date=${encodeURIComponent(date.trim())}` : '';
  return api<{ count: number }>(`/predictions/generate-today${q}`);
}
