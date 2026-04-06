import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Prognostic,
  PrognosticPlan,
} from '../prognostic/prognostic.entity';

const PLAN_ORDER: Record<PrognosticPlan, number> = {
  [PrognosticPlan.FREE]: 0,
  [PrognosticPlan.PREMIUM]: 1,
  [PrognosticPlan.VIP]: 2,
};

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
   * plano mínimo é compatível com o plano atual (PREMIUM não vê só-VIP).
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
      const required = PLAN_ORDER[row.plan as PrognosticPlan] ?? 0;
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
    if (plan === 'VIP') return PLAN_ORDER[PrognosticPlan.VIP];
    if (plan === 'PREMIUM') return PLAN_ORDER[PrognosticPlan.PREMIUM];
    return PLAN_ORDER[PrognosticPlan.FREE];
  }
}
