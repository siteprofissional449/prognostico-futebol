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

function applyDateRange(
  list: Prognostic[],
  from?: string,
  to?: string,
): Prognostic[] {
  let out = list;
  if (from) {
    out = out.filter(
      (row) => localDateKey(new Date(row.matchDate)) >= from,
    );
  }
  if (to) {
    out = out.filter(
      (row) => localDateKey(new Date(row.matchDate)) <= to,
    );
  }
  return out;
}

@Injectable()
export class PremiumService {
  constructor(
    @InjectRepository(Prognostic)
    private readonly prognosticRepo: Repository<Prognostic>,
  ) {}

  /**
   * Assinantes: palpites manuais **pagos** (plano mínimo ≥ Diário). Os só **grátis**
   * ficam em `listFreeManualPrognostics` para todos.
   * Usa `userAccessTier` (0–3, igual ao UsersService) para filtrar o mínimo exigido.
   */
  async listPrognosticsForPlan(
    userAccessTier: number,
    from?: string,
    to?: string,
  ): Promise<Prognostic[]> {
    const tier = Number.isFinite(userAccessTier) ? userAccessTier : 0;
    let list = await this.prognosticRepo.find({
      order: { matchDate: 'DESC', createdAt: 'DESC' },
    });
    list = list.filter((row) => {
      if (String(row.plan) === PrognosticPlan.FREE) return false;
      const required = prognosticRequiredTier(String(row.plan));
      return required <= tier;
    });
    return applyDateRange(list, from, to);
  }

  /** Palpites manuais marcados como grátis — qualquer visitante (com ou sem login). */
  async listFreeManualPrognostics(
    from?: string,
    to?: string,
  ): Promise<Prognostic[]> {
    const list = await this.prognosticRepo.find({
      where: { plan: PrognosticPlan.FREE },
      order: { matchDate: 'DESC', createdAt: 'DESC' },
    });
    return applyDateRange(list, from, to);
  }

}
