import { api } from './client';
import type { AdminPrognostic } from '../types';

export function getPremiumPrognostics(params?: { from?: string; to?: string }) {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const qs = q.toString();
  return api<AdminPrognostic[]>(
    `/premium/prognostics${qs ? `?${qs}` : ''}`,
  );
}
