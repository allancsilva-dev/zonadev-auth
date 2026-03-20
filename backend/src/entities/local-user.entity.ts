import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TenantRole } from './tenant-role.entity';

@Entity('local_users')
@Unique('uq_local_users_auth_tenant', ['authUserId', 'tenantId'])
export class LocalUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_local_users_auth')
  @Column({ name: 'auth_user_id', type: 'uuid' })
  authUserId: string;

  @Index('idx_local_users_tenant')
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => TenantRole, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'role_id' })
  role: TenantRole;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'provisioned_at', type: 'timestamptz' })
  provisionedAt: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;
}
