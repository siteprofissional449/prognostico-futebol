import { api } from './client';

export async function mercadoPagoCheckout(planCode: string): Promise<{ url: string }> {
  return api<{ url: string }>('/payments/mercadopago/checkout', {
    method: 'POST',
    body: JSON.stringify({ planCode }),
  });
}

/** Consulta o MP por pagamentos aprovados deste utilizador e atualiza o plano (fallback ao webhook). */
export async function mercadoPagoSyncApproved(): Promise<{
  synced: boolean;
  plan: string;
  expiresAt: string | null;
}> {
  return api('/payments/mercadopago/sync-approved', { method: 'POST' });
}
