import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
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

  @Index('idx_apps_audience_unique', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  audience: string;

  @Column({ name: 'allow_origin', type: 'text' })
  allowOrigin: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
