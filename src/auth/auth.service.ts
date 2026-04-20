import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

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
    const access = await this.usersService.getUserAccessContext(user.id);
    const payload = {
      sub: user.id,
      email: user.email,
      plan: access.plan,
      userAccessTier: access.userAccessTier,
      expiresAt: access.expiresAt,
      isAdmin: !!user.isAdmin,
    };
    const access_token = await this.jwtService.signAsync(payload);
    return {
      access_token,
      plan: access.plan,
      userAccessTier: access.userAccessTier,
      expiresAt: access.expiresAt,
      isAdmin: !!user.isAdmin,
    };
  }

  /** Plano e permissões atuais (BD), para atualizar o cliente após pagamento sem novo login. */
  async session(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Sessão inválida');
    }
    const access = await this.usersService.getUserAccessContext(userId);
    return {
      plan: access.plan,
      userAccessTier: access.userAccessTier,
      expiresAt: access.expiresAt,
      isAdmin: !!user.isAdmin,
    };
  }
}
