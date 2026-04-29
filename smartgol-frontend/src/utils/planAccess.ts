import type { PlanType } from '../types';

/** Plano com acesso ao histórico de acertos (API + UI). */
export function canSeeHistory(plan: PlanType | string | null | undefined): boolean {
  return plan === 'WEEKLY' || plan === 'MONTHLY' || plan === 'PREMIUM';
}

/** Plano pago: vê palpites premium / análises desbloqueadas no dia. */
export function canAccessPaidPredictions(plan: PlanType | string | null | undefined): boolean {
  return (
    plan === 'DAILY' || plan === 'WEEKLY' || plan === 'MONTHLY' || plan === 'PREMIUM'
  );
}
