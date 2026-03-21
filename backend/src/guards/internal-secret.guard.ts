import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type RequestWithInternal = {
  headers: Record<string, string | string[] | undefined>;
  internalCall?: boolean;
};

@Injectable()
export class InternalSecretGuard implements CanActivate {
  private readonly internalSecret: string;

  constructor(private readonly config: ConfigService) {
    this.internalSecret = this.config.getOrThrow<string>('AUTH_INTERNAL_SECRET');
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithInternal>();
    const rawHeader = req.headers['x-internal-secret'];
    const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!value) {
      req.internalCall = false;
      return true;
    }

    if (value !== this.internalSecret) {
      throw new UnauthorizedException('X-Internal-Secret inválido');
    }

    req.internalCall = true;
    return true;
  }
}
