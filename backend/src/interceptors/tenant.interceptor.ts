import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant não identificado');
    }

    req.tenantId = tenantId;
    return next.handle();
  }
}
