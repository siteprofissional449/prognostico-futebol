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

/** Remove prognósticos automáticos de uma data. Requer JWT de administrador. */
export function adminClearPredictions(date: string, resetMeta: boolean) {
  const params = new URLSearchParams();
  params.set('date', date.trim());
  if (resetMeta) params.set('resetMeta', 'true');
  return api<{ deleted: number; date: string; resetMeta: boolean }>(
    `/admin/predictions?${params.toString()}`,
    { method: 'DELETE' },
  );
}
