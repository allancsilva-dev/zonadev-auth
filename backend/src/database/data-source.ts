import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';
import { Plan } from '../entities/plan.entity';
import { Subscription } from '../entities/subscription.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { App } from '../entities/app.entity';
import { Session } from '../entities/session.entity';
import { UserAppAccess } from '../entities/user-app-access.entity';
import { Client } from '../clients/client.entity';
import { ClientRedirectUri } from '../clients/client-redirect-uri.entity';
import { AuthorizationGrant } from '../grants/authorization-grant.entity';
import { UserSession } from '../sessions/user-session.entity';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    Tenant,
    User,
    Plan,
    Subscription,
    RefreshToken,
    AuditLog,
    App,
    Session,
    UserAppAccess,
    Client,
    ClientRedirectUri,
    AuthorizationGrant,
    UserSession,
  ],
  migrations: [
    process.env.NODE_ENV === 'production'
      ? 'dist/database/migrations/*.js'
      : 'src/database/migrations/*.ts',
  ],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
