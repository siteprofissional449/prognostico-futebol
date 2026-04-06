import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { isAdmin?: boolean } }>();
    if (!req.user?.isAdmin) {
      throw new ForbiddenException('Acesso restrito a administradores');
    }
    return true;
  }
}
