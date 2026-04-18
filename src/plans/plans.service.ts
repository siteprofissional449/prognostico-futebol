import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan, PlanBillingPeriod } from './plan.entity';
import { User } from '../users/user.entity';
import { Prognostic, PrognosticPlan } from '../prognostic/prognostic.entity';
import { Prediction, PlanType } from '../predictions/prediction.entity';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  async findAll(): Promise<Plan[]> {
    return this.planRepo.find({ order: { sortOrder: 'ASC', price: 'ASC' } });
  }

  async findByCode(code: string): Promise<Plan | null> {
    return this.planRepo.findOne({ where: { code } });
  }

  /**
   * Catálogo de membros: FREE, DAILY, WEEKLY e MONTHLY.
   * paymentPriceId pode ser preenchido depois (gateway de pagamento).
   */
  async seedPlans(): Promise<void> {
    const defaults: Array<{
      code: string;
      name: string;
      description: string;
      price: number;
      billingPeriod: PlanBillingPeriod;
      sortOrder: number;
    }> = [
      {
        code: 'FREE',
        name: 'Grátis',
        description: 'Palpites básicos e navegação limitada entre dias.',
        price: 0,
        billingPeriod: 'NONE',
        sortOrder: 0,
      },
      {
        code: 'DAILY',
        name: 'Membro diário',
        description: 'Acesso ampliado aos palpites do dia; renovação diária.',
        price: 2.99,
        billingPeriod: 'DAILY',
        sortOrder: 1,
      },
      {
        code: 'WEEKLY',
        name: 'Membro semanal',
        description: 'Mais jogos e filtros; renovação a cada 7 dias.',
        price: 11.99,
        billingPeriod: 'WEEKLY',
        sortOrder: 2,
      },
      {
        code: 'MONTHLY',
        name: 'Membro mensal',
        description: 'Tudo que o site oferece em palpites automáticos + área premium de conteúdo.',
        price: 39.99,
        billingPeriod: 'MONTHLY',
        sortOrder: 3,
      },
    ];

    for (const d of defaults) {
      let row = await this.planRepo.findOne({ where: { code: d.code } });
      if (row) {
        row.name = d.name;
        row.description = d.description;
        row.price = d.price;
        row.billingPeriod = d.billingPeriod;
        row.sortOrder = d.sortOrder;
        await this.planRepo.save(row);
      } else {
        await this.planRepo.save(
          this.planRepo.create({
            ...d,
            paymentProvider: null,
            paymentPriceId: null,
          }),
        );
      }
    }
    await this.normalizeLegacyPlans();
  }

  /**
   * Migra planos legados:
   * - VIP -> MONTHLY
   * - PREMIUM -> MONTHLY
   */
  private async normalizeLegacyPlans(): Promise<void> {
    const monthly = await this.planRepo.findOne({ where: { code: 'MONTHLY' } });
    if (!monthly) return;

    for (const legacyCode of ['VIP', 'PREMIUM']) {
      const legacy = await this.planRepo.findOne({ where: { code: legacyCode } });
      if (!legacy) continue;

      const moved = await this.planRepo.manager
        .createQueryBuilder()
        .update(User)
        .set({ currentPlanId: monthly.id })
        .where('currentPlanId = :id', { id: legacy.id })
        .execute();

      await this.planRepo.manager
        .createQueryBuilder()
        .update(Prognostic)
        .set({ plan: PrognosticPlan.PREMIUM })
        .where('plan = :c', { c: legacyCode })
        .execute();

      await this.planRepo.manager
        .createQueryBuilder()
        .update(Prediction)
        .set({ minPlan: PlanType.MONTHLY })
        .where('minPlan = :c', { c: legacyCode })
        .execute();

      await this.planRepo.delete({ id: legacy.id });
      const n = typeof moved.affected === 'number' ? moved.affected : 0;
      if (n > 0) {
        this.logger.log(
          `Plano legado ${legacyCode} migrado: ${n} utilizador(es) para MONTHLY.`,
        );
      }
    }
  }
}
