import { api } from './client';
import type { AdminPrognostic, AdminPrognosticPayload } from '../types';

export function listAdminPrognostics() {
  return api<AdminPrognostic[]>('/admin/prognostics');
}

export function createAdminPrognostic(body: AdminPrognosticPayload) {
  return api<AdminPrognostic>('/admin/prognostics', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateAdminPrognostic(
  id: string,
  body: Partial<AdminPrognosticPayload>,
) {
  return api<AdminPrognostic>(`/admin/prognostics/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteAdminPrognostic(id: string) {
  return api<{ ok: boolean }>(`/admin/prognostics/${id}`, {
    method: 'DELETE',
  });
}
