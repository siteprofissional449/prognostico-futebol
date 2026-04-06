import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { PlanType } from '../predictions/prediction.entity';
import { Plan } from '../plans/plan.entity';

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
    const code = user.currentPlan.code;
    if (code === 'VIP') return PlanType.VIP;
    if (code === 'PREMIUM') return PlanType.PREMIUM;
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

    if (dto.planCode === 'FREE') {
      user.currentPlanId = null;
      user.planExpiresAt = null;
    } else if (dto.planCode === 'PREMIUM' || dto.planCode === 'VIP') {
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
}
