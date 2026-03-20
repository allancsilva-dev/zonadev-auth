import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('tenant_roles')
@Unique('uq_tenant_roles_tenant_name', ['tenantId', 'name'])
export class TenantRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_tenant_roles_tenant')
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
