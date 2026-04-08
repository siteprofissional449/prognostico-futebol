import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { PlanType } from '../predictions/prediction.entity';
import { Plan, PlanBillingPeriod } from '../plans/plan.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { email },
      relations: ['currentPlan'],
    });
  }

  async createUser(email: string, password: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({ email, passwordHash });
    return this.userRepo.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({
      where: { id },
      relations: ['currentPlan'],
    });
  }

  async getUserPlanType(userId: string): Promise<PlanType> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['currentPlan'],
    });
    if (!user?.currentPlan) return PlanType.FREE;
    if (user.planExpiresAt && new Date() > user.planExpiresAt)
      return PlanType.FREE;
    const code =
      user.currentPlan.code === 'VIP' ? 'PREMIUM' : user.currentPlan.code;
    if (code === 'PREMIUM') return PlanType.PREMIUM;
    if (code === 'WEEKLY') return PlanType.WEEKLY;
    if (code === 'DAILY') return PlanType.DAILY;
    return PlanType.FREE;
  }

  async promoteEnvAdmin(): Promise<void> {
    const email = process.env.ADMIN_EMAIL?.trim();
    if (!email) return;
    const user = await this.findByEmail(email);
    if (!user || user.isAdmin) return;
    await this.userRepo.update({ id: user.id }, { isAdmin: true });
  }

  async findAllForAdmin(): Promise<User[]> {
    return this.userRepo.find({
      relations: ['currentPlan'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateUserAdmin(
    userId: string,
    dto: { planCode?: string; planExpiresAt?: string | null },
  ): Promise<User> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const paidCodes = ['DAILY', 'WEEKLY', 'PREMIUM'];
    if (dto.planCode === 'FREE') {
      user.currentPlanId = null;
      user.planExpiresAt = null;
    } else if (dto.planCode && paidCodes.includes(dto.planCode)) {
      const plan = await this.planRepo.findOne({
        where: { code: dto.planCode },
      });
      if (!plan) throw new NotFoundException('Plano inválido');
      user.currentPlanId = plan.id;
      if (dto.planExpiresAt !== undefined) {
        user.planExpiresAt = dto.planExpiresAt
          ? new Date(dto.planExpiresAt)
          : null;
      }
    } else if (dto.planExpiresAt !== undefined) {
      user.planExpiresAt = dto.planExpiresAt
        ? new Date(dto.planExpiresAt)
        : null;
    }

    await this.userRepo.save(user);
    const updated = await this.findById(userId);
    if (!updated) throw new NotFoundException('Usuário não encontrado');
    return updated;
  }

  /** Libera assinatura após pagamento aprovado (Mercado Pago, etc.). */
  async grantSubscriptionByPlanCode(
    userId: string,
    planCode: string,
  ): Promise<void> {
    const paid = ['DAILY', 'WEEKLY', 'PREMIUM'];
    if (!paid.includes(planCode)) {
      throw new BadRequestException('Plano inválido para assinatura.');
    }
    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    if (!plan || Number(plan.price) <= 0) {
      throw new BadRequestException('Plano não encontrado.');
    }
    const until = this.computeExpiryFromBilling(plan.billingPeriod);
    await this.updateUserAdmin(userId, {
      planCode,
      planExpiresAt: until.toISOString(),
    });
  }

  private computeExpiryFromBilling(period: PlanBillingPeriod): Date {
    const d = new Date();
    switch (period) {
      case 'DAILY':
        d.setDate(d.getDate() + 1);
        break;
      case 'WEEKLY':
        d.setDate(d.getDate() + 7);
        break;
      case 'MONTHLY':
        d.setMonth(d.getMonth() + 1);
        break;
      default:
        d.setMonth(d.getMonth() + 1);
    }
    return d;
  }
}
