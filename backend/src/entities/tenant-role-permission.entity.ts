import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantRole } from './tenant-role.entity';
import { Permission } from './permission.entity';

@Entity('tenant_role_permissions')
export class TenantRolePermission {
  @Index('idx_role_perms_role')
  @PrimaryColumn({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @ManyToOne(() => TenantRole, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: TenantRole;

  @ManyToOne(() => Permission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: Permission;
}
