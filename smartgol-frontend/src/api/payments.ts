import { api } from './client';

export async function mercadoPagoCheckout(planCode: string): Promise<{ url: string }> {
  return api<{ url: string }>('/payments/mercadopago/checkout', {
    method: 'POST',
    body: JSON.stringify({ planCode }),
  });
}
