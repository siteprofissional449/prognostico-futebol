import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Prognostic,
  PrognosticPlan,
} from '../prognostic/prognostic.entity';

const PLAN_ORDER: Record<PrognosticPlan, number> = {
  [PrognosticPlan.FREE]: 0,
  [PrognosticPlan.DAILY]: 1,
  [PrognosticPlan.WEEKLY]: 2,
  [PrognosticPlan.PREMIUM]: 3,
};

/** Plano mínimo do prognóstico (hierarquia FREE → PREMIUM). */
function prognosticRequiredTier(plan: string): number {
  const p = plan as PrognosticPlan;
  return PLAN_ORDER[p] ?? PLAN_ORDER[PrognosticPlan.PREMIUM];
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable()
export class PremiumService {
  constructor(
    @InjectRepository(Prognostic)
    private readonly prognosticRepo: Repository<Prognostic>,
  ) {}

  /**
   * Mesma lógica dos prognósticos automáticos: o utilizador vê entradas cujo
   * plano mínimo do conteúdo é compatível com o plano do usuário.
   */
  async listPrognosticsForPlan(
    userPlan: string,
    from?: string,
    to?: string,
  ): Promise<Prognostic[]> {
    const tier = this.planToTier(userPlan);
    let list = await this.prognosticRepo.find({
      order: { matchDate: 'DESC', createdAt: 'DESC' },
    });
    list = list.filter((row) => {
      const required = prognosticRequiredTier(String(row.plan));
      return required <= tier;
    });
    if (from) {
      list = list.filter(
        (row) => localDateKey(new Date(row.matchDate)) >= from,
      );
    }
    if (to) {
      list = list.filter(
        (row) => localDateKey(new Date(row.matchDate)) <= to,
      );
    }
    return list;
  }

  private planToTier(plan: string): number {
    if (plan === 'MONTHLY' || plan === 'PREMIUM') {
      return PLAN_ORDER[PrognosticPlan.PREMIUM];
    }
    if (plan === 'WEEKLY') return PLAN_ORDER[PrognosticPlan.WEEKLY];
    if (plan === 'DAILY') return PLAN_ORDER[PrognosticPlan.DAILY];
    return PLAN_ORDER[PrognosticPlan.FREE];
  }
}
