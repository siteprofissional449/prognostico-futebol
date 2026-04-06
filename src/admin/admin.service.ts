import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Prediction } from '../predictions/prediction.entity';
import { UsersService } from '../users/users.service';

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
}
