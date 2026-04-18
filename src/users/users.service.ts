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
import { Plan } from '../plans/plan.entity';

export interface UserAccessContext {
  plan: PlanType;
  userAccessTier: number;
  expiresAt: string | null;
  isPremium: boolean;
  canAccessHistory: boolean;
  canAccessPastResults: boolean;
}

const PLAN_TIER: Record<PlanType, number> = {
  [PlanType.FREE]: 0,
  [PlanType.DAILY]: 1,
  [PlanType.WEEKLY]: 2,
  [PlanType.MONTHLY]: 3,
  [PlanType.PREMIUM]: 3,
};

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

  planToTier(plan: PlanType | string): number {
    const p = String(plan).toUpperCase() as PlanType;
    return PLAN_TIER[p] ?? PLAN_TIER[PlanType.FREE];
  }

  private normalizePlanCode(code: string | undefined | null): PlanType {
    const c = String(code || '').trim().toUpperCase();
    if (c === 'DAILY') return PlanType.DAILY;
    if (c === 'WEEKLY') return PlanType.WEEKLY;
    if (c === 'MONTHLY' || c === 'PREMIUM') return PlanType.MONTHLY;
    return PlanType.FREE;
  }

  calculateExpiration(planType: PlanType | string, purchaseDate: Date): Date {
    const plan = this.normalizePlanCode(String(planType));
    const base = new Date(purchaseDate);
    switch (plan) {
      case PlanType.DAILY: {
        // Regra SaaS: plano diário vence no fim do dia da compra.
        const end = new Date(base);
        end.setHours(23, 59, 59, 999);
        return end;
      }
      case PlanType.WEEKLY: {
        const d = new Date(base);
        d.setDate(d.getDate() + 7);
        return d;
      }
      case PlanType.MONTHLY:
      case PlanType.PREMIUM: {
        const d = new Date(base);
        d.setDate(d.getDate() + 30);
        return d;
      }
      default:
        return base;
    }
  }

  isUserPremium(user: Pick<User, 'currentPlan' | 'planExpiresAt'>): boolean {
    const plan = this.normalizePlanCode(user.currentPlan?.code);
    if (this.planToTier(plan) <= 0) return false;
    if (!user.planExpiresAt) return false;
    return new Date() < user.planExpiresAt;
  }

  async getUserAccessContext(userId: string): Promise<UserAccessContext> {
    const user = await this.findById(userId);
    if (!user) {
      return this.getPublicAccessContext();
    }
    const plan = this.normalizePlanCode(user.currentPlan?.code);
    const active = this.isUserPremium(user);
    const effectivePlan = active ? plan : PlanType.FREE;
    const tier = this.planToTier(effectivePlan);
    return {
      plan: effectivePlan,
      userAccessTier: tier,
      expiresAt: user.planExpiresAt?.toISOString() ?? null,
      isPremium: tier > 0,
      canAccessHistory: tier >= this.planToTier(PlanType.WEEKLY),
      canAccessPastResults: tier >= this.planToTier(PlanType.WEEKLY),
    };
  }

  getPublicAccessContext(): UserAccessContext {
    return {
      plan: PlanType.FREE,
      userAccessTier: PLAN_TIER[PlanType.FREE],
      expiresAt: null,
      isPremium: false,
      canAccessHistory: false,
      canAccessPastResults: false,
    };
  }

  async getUserPlanType(userId: string): Promise<PlanType> {
    const ctx = await this.getUserAccessContext(userId);
    return ctx.plan;
  }

  async promoteEnvAdmin(): Promise<void> {
    const email = process.env.ADMIN_EMAIL?.trim();
    if (!email) return;
    const user = await this.findByEmail(email);
    if (!user || user.isAdmin) return;
    await this.userRepo.update({ id: user.id }, { isAdmin: true });
  }

  /**
   * Cria ou atualiza utilizador com palavra-passe e isAdmin (script bootstrap).
   * Não expor credenciais em ficheiros versionados.
   */
  async ensureAdminAccount(email: string, plainPassword: string): Promise<void> {
    const normalized = email.trim();
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const existing = await this.findByEmail(normalized);
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.isAdmin = true;
      await this.userRepo.save(existing);
      return;
    }
    const user = this.userRepo.create({
      email: normalized,
      passwordHash,
      isAdmin: true,
    });
    await this.userRepo.save(user);
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

    const paidCodes = ['DAILY', 'WEEKLY', 'MONTHLY', 'PREMIUM'];
    if (dto.planCode === 'FREE') {
      user.currentPlanId = null;
      user.planExpiresAt = null;
    } else if (dto.planCode && paidCodes.includes(dto.planCode)) {
      const normalizedCode =
        dto.planCode === 'PREMIUM' ? 'MONTHLY' : dto.planCode;
      const plan = await this.planRepo.findOne({
        where: { code: normalizedCode },
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
    const normalized = planCode.trim().toUpperCase() === 'PREMIUM'
      ? 'MONTHLY'
      : planCode.trim().toUpperCase();
    const paid = ['DAILY', 'WEEKLY', 'MONTHLY'];
    if (!paid.includes(normalized)) {
      throw new BadRequestException('Plano inválido para assinatura.');
    }
    const plan = await this.planRepo.findOne({ where: { code: normalized } });
    if (!plan || Number(plan.price) <= 0) {
      throw new BadRequestException('Plano não encontrado.');
    }
    const until = this.calculateExpiration(normalized, new Date());
    await this.updateUserAdmin(userId, {
      planCode: normalized,
      planExpiresAt: until.toISOString(),
    });
  }

}
