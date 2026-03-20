import { SetMetadata } from '@nestjs/common';
import { REQUIRED_PERMISSIONS_KEY } from '../../guards/permission.guard';

export const RequiredPermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
