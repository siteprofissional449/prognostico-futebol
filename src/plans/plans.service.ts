import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './plan.entity';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  async findAll(): Promise<Plan[]> {
    return this.planRepo.find({ order: { price: 'ASC' } });
  }

  async findByCode(code: string): Promise<Plan | null> {
    return this.planRepo.findOne({ where: { code } });
  }

  /**
   * Garante os três planos no catálogo e atualiza preços/períodos (ex.: Premium 9,99/semana).
   * Pode rodar em todo arranque da API para alinhar bases antigas.
   */
  async seedPlans(): Promise<void> {
    const defaults: Array<{
      code: string;
      name: string;
      price: number;
      billingPeriod: 'WEEKLY' | 'MONTHLY';
    }> = [
      { code: 'FREE', name: 'Grátis', price: 0, billingPeriod: 'MONTHLY' },
      {
        code: 'PREMIUM',
        name: 'Premium',
        price: 9.99,
        billingPeriod: 'WEEKLY',
      },
      { code: 'VIP', name: 'VIP', price: 79.9, billingPeriod: 'MONTHLY' },
    ];

    for (const d of defaults) {
      let row = await this.planRepo.findOne({ where: { code: d.code } });
      if (row) {
        row.name = d.name;
        row.price = d.price;
        row.billingPeriod = d.billingPeriod;
        await this.planRepo.save(row);
      } else {
        await this.planRepo.save(this.planRepo.create(d));
      }
    }
  }
}
