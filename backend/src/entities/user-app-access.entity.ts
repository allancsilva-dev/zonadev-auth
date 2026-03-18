import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { App } from './app.entity';

@Entity('user_app_access')
export class UserAppAccess {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_uaa_user')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index('idx_uaa_app')
  @Column({ name: 'app_id', type: 'uuid' })
  appId: string;

  @ManyToOne(() => App, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'app_id' })
  app: App;

  @Column({ name: 'default_role', type: 'varchar', length: 50, default: 'viewer' })
  defaultRole: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'granted_at', type: 'timestamptz' })
  grantedAt: Date;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true })
  grantedBy: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'granted_by' })
  grantedByUser: User | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
