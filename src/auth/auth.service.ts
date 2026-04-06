import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { PlanType } from '../predictions/prediction.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string): Promise<User> {
    const exists = await this.usersService.findByEmail(email);
    if (exists) {
      throw new UnauthorizedException('E-mail já cadastrado');
    }
    return this.usersService.createUser(email, password);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const plan = await this.usersService.getUserPlanType(user.id);
    const payload = {
      sub: user.id,
      email: user.email,
      plan,
      isAdmin: !!user.isAdmin,
    };
    const access_token = await this.jwtService.signAsync(payload);
    return { access_token, plan, isAdmin: !!user.isAdmin };
  }
}
