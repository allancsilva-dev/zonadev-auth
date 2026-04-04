import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { ClientRedirectUri } from './client-redirect-uri.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'varchar', length: 100, unique: true })
  clientId: string;

  @Column({ name: 'client_secret_hash', type: 'varchar', length: 255, nullable: true })
  clientSecretHash: string | null;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'back_channel_logout_uri', type: 'varchar', length: 500, nullable: true })
  backChannelLogoutUri: string | null;

  @Column({
    name: 'grant_types',
    type: 'jsonb',
    default: ['authorization_code', 'refresh_token'],
  })
  grantTypes: string[];

  @Column({
    name: 'allowed_scopes',
    type: 'jsonb',
    default: ['openid', 'profile', 'email'],
  })
  allowedScopes: string[];

  @Column({ name: 'access_token_ttl', type: 'integer', default: 900 })
  accessTokenTtl: number;

  @Column({ name: 'refresh_token_ttl', type: 'integer', default: 604800 })
  refreshTokenTtl: number;

  @Column({ name: 'max_sessions_per_user', type: 'integer', default: 10 })
  maxSessionsPerUser: number;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => ClientRedirectUri, (uri) => uri.client, { eager: false })
  redirectUris: ClientRedirectUri[];

  @Column({ name: 'active', type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}