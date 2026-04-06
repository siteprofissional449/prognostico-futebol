import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Prediction, PlanType } from './prediction.entity';

const PLAN_ORDER: Record<PlanType, number> = {
  [PlanType.FREE]: 0,
  [PlanType.PREMIUM]: 1,
  [PlanType.VIP]: 2,
};

@Injectable()
export class PredictionsService {
  constructor(
    @InjectRepository(Prediction)
    private readonly predictionRepo: Repository<Prediction>,
  ) {}

  async findByPlan(plan: PlanType, date?: string): Promise<Prediction[]> {
    const targetDate = date || this.today();
    const minLevel = PLAN_ORDER[plan];
    const list = await this.predictionRepo.find({
      where: { predictionDate: targetDate },
      order: { probability: 'DESC', createdAt: 'ASC' },
    });
    return list.filter(
      (p) => PLAN_ORDER[p.minPlan as PlanType] <= minLevel,
    );
  }

  async saveMany(predictions: Partial<Prediction>[]): Promise<Prediction[]> {
    const entities = this.predictionRepo.create(predictions);
    return this.predictionRepo.save(entities);
  }

  async clearByDate(date: string): Promise<void> {
    await this.predictionRepo.delete({ predictionDate: date });
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
