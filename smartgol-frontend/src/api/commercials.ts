import { api } from './client';
import type { CommercialAdmin, CommercialPublic } from '../types';

export function fetchActiveCommercials() {
  return api<CommercialPublic[]>('/commercials/active');
}

export function adminListCommercials() {
  return api<CommercialAdmin[]>('/admin/commercials');
}

export function adminCreateCommercial(body: {
  imageUrl: string;
  linkUrl: string;
  title?: string | null;
  sortOrder?: number;
  active?: boolean;
}) {
  return api<CommercialAdmin>('/admin/commercials', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function adminPatchCommercial(
  id: string,
  body: Partial<{
    imageUrl: string;
    linkUrl: string;
    title: string | null;
    sortOrder: number;
    active: boolean;
  }>,
) {
  return api<CommercialAdmin>(`/admin/commercials/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function adminDeleteCommercial(id: string) {
  return api<void>(`/admin/commercials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
