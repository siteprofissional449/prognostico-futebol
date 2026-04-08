import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class PremiumGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { plan?: string } }>();
    const plan = req.user?.plan;
    if (plan === 'DAILY' || plan === 'WEEKLY' || plan === 'PREMIUM' || plan === 'VIP')
      return true;
    throw new ForbiddenException(
      'Área exclusiva para assinantes (Diário, Semanal ou Premium).',
    );
  }
}
