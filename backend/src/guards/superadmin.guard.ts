import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const hasRole = req.user?.roles?.includes('SUPERADMIN');

    if (!hasRole) {
      throw new ForbiddenException('Acesso restrito a SUPERADMIN');
    }

    return true;
  }
}
