import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Client } from './client.entity';

@Entity('client_redirect_uris')
export class ClientRedirectUri {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  @ManyToOne(() => Client, (client) => client.redirectUris, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'uri_type', type: 'varchar', length: 10 })
  uriType: 'login' | 'logout';

  @Column({ name: 'uri', type: 'varchar', length: 500 })
  uri: string;
}