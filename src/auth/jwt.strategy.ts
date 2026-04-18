import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  plan: string;
  userAccessTier?: number;
  expiresAt?: string | null;
  isAdmin?: boolean;
}

/**
 * Em cada pedido autenticado, o plano vem da **base de dados** (não só do JWT),
 * para que alterações no admin (ou pagamento) tenham efeito sem novo login.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'smartgol-dev-secret',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    const access = await this.usersService.getUserAccessContext(payload.sub);
    return {
      userId: payload.sub,
      email: user.email,
      plan: access.plan,
      userAccessTier: access.userAccessTier,
      expiresAt: access.expiresAt,
      isAdmin: !!user.isAdmin,
    };
  }
}
