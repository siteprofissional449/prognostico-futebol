import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan, PlanBillingPeriod } from './plan.entity';

@Injectable()
export class PlansService {
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
   * Catálogo de membros: grátis, diário, semanal, premium mensal.
   * Preços alinhados à vitrine; paymentPriceId preenchido quando integrar gateway.
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
        code: 'PREMIUM',
        name: 'Premium mensal',
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
  }
}
