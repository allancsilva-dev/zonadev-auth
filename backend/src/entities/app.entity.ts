import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('apps')
export class App {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_apps_slug_unique', { unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index('idx_apps_domain_unique', { unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  domain: string | null;

  @Column({ name: 'base_url', type: 'text', nullable: true })
  baseUrl: string | null;

  @Column({ name: 'post_logout_redirect_uris', type: 'text', array: true, nullable: true })
  postLogoutRedirectUris: string[] | null;

  @Index('idx_apps_audience_unique', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  audience: string;

  @Column({ name: 'allow_origin', type: 'text' })
  allowOrigin: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;
}
