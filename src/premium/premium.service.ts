import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

/**
 * Data de calendário do `matchDate` no mesmo fuso que o frontend (`CRON_TZ` / VITE_APP_TIMEZONE).
 * Evita sumir palpites à noite no Brasil quando o servidor está em UTC.
 */
function matchDateYmdInAppTimezone(d: Date, timeZone: string): string {
  return new Date(d.getTime()).toLocaleDateString('sv-SE', { timeZone });
}

function applyDateRange(
  list: Prognostic[],
  from: string | undefined,
  to: string | undefined,
  timeZone: string,
): Prognostic[] {
  let out = list;
  if (from) {
    out = out.filter(
      (row) =>
        matchDateYmdInAppTimezone(new Date(row.matchDate), timeZone) >= from,
    );
  }
  if (to) {
    out = out.filter(
      (row) =>
        matchDateYmdInAppTimezone(new Date(row.matchDate), timeZone) <= to,
    );
  }
  return out;
}

@Injectable()
export class PremiumService {
  private readonly appTimeZone: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Prognostic)
    private readonly prognosticRepo: Repository<Prognostic>,
  ) {
    this.appTimeZone =
      this.config.get<string>('CRON_TZ') || 'America/Sao_Paulo';
  }

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
    return applyDateRange(list, from, to, this.appTimeZone);
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
    return applyDateRange(list, from, to, this.appTimeZone);
  }

}
