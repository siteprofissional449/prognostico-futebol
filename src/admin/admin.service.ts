import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Prediction } from '../predictions/prediction.entity';
import { UsersService } from '../users/users.service';
import { GenerationMeta } from '../football/generation-meta.entity';

function userToPublic(u: User) {
  return {
    id: u.id,
    email: u.email,
    isAdmin: u.isAdmin,
    planExpiresAt: u.planExpiresAt,
    createdAt: u.createdAt,
    currentPlan: u.currentPlan
      ? {
          id: u.currentPlan.id,
          code: u.currentPlan.code,
          name: u.currentPlan.name,
        }
      : null,
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Prediction)
    private readonly predictionRepo: Repository<Prediction>,
    @InjectRepository(GenerationMeta)
    private readonly generationMetaRepo: Repository<GenerationMeta>,
  ) {}

  async getStats() {
    const [userCount, predictionCount] = await Promise.all([
      this.userRepo.count(),
      this.predictionRepo.count(),
    ]);
    return { userCount, predictionCount };
  }

  async listUsers() {
    const users = await this.usersService.findAllForAdmin();
    return users.map(userToPublic);
  }

  async updateUser(
    userId: string,
    dto: { planCode?: string; planExpiresAt?: string | null },
  ) {
    const u = await this.usersService.updateUserAdmin(userId, dto);
    return userToPublic(u);
  }

  private assertYmd(date: string): string {
    const s = date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      throw new BadRequestException('date deve ser YYYY-MM-DD');
    }
    const d = new Date(`${s}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('date inválida');
    }
    if (d.toISOString().slice(0, 10) !== s) {
      throw new BadRequestException('date inválida');
    }
    return s;
  }

  /**
   * Remove todos os prognósticos automáticos gravados para uma data civil.
   * Opcionalmente reinicia o registo de “última geração” (útil após testes/mock).
   */
  async clearPredictionsForDate(
    date: string,
    resetMeta: boolean,
  ): Promise<{ deleted: number; date: string; resetMeta: boolean }> {
    const ymd = this.assertYmd(date);
    const res = await this.predictionRepo.delete({ predictionDate: ymd });
    const deleted = typeof res.affected === 'number' ? res.affected : 0;

    if (resetMeta) {
      const id = 'singleton';
      let row = await this.generationMetaRepo.findOne({ where: { id } });
      if (!row) {
        row = this.generationMetaRepo.create({
          id,
          lastPredictionsAt: null,
          lastCount: 0,
        });
      } else {
        row.lastPredictionsAt = null;
        row.lastCount = 0;
      }
      await this.generationMetaRepo.save(row);
    }

    return { deleted, date: ymd, resetMeta };
  }
}
