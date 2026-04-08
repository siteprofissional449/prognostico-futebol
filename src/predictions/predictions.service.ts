import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Prediction, PlanType } from './prediction.entity';

const PLAN_ORDER: Record<PlanType, number> = {
  [PlanType.FREE]: 0,
  [PlanType.DAILY]: 1,
  [PlanType.WEEKLY]: 2,
  [PlanType.PREMIUM]: 3,
};

function userAccessTier(plan: string): number {
  if (plan === 'VIP') return PLAN_ORDER[PlanType.PREMIUM];
  const t = plan as PlanType;
  return t in PLAN_ORDER ? PLAN_ORDER[t] : PLAN_ORDER[PlanType.FREE];
}

/** Palpite exige este nível mínimo (aceita VIP legado = PREMIUM). */
function predictionMinTier(minPlan: string): number {
  if (minPlan === 'VIP') return PLAN_ORDER[PlanType.PREMIUM];
  const t = minPlan as PlanType;
  return t in PLAN_ORDER ? PLAN_ORDER[t] : PLAN_ORDER[PlanType.PREMIUM];
}

@Injectable()
export class PredictionsService {
  constructor(
    @InjectRepository(Prediction)
    private readonly predictionRepo: Repository<Prediction>,
  ) {}

  async findByPlan(plan: PlanType | string, date?: string): Promise<Prediction[]> {
    const targetDate = date || this.today();
    const userLevel = userAccessTier(String(plan));
    const list = await this.predictionRepo.find({
      where: { predictionDate: targetDate },
      order: { probability: 'DESC', createdAt: 'ASC' },
    });
    return list.filter((p) => predictionMinTier(String(p.minPlan)) <= userLevel);
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
