import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './clients/client.entity';
import { ClientRedirectUri } from './clients/client-redirect-uri.entity';
import { ClientsService } from './clients/clients.service';
import { UserSession } from './sessions/user-session.entity';
import { UserSessionsService } from './sessions/user-sessions.service';
import { AuthorizationGrant } from './grants/authorization-grant.entity';
import { GrantsService } from './grants/grants.service';

@Module({
  imports: [TypeOrmModule.forFeature([Client, ClientRedirectUri])],
  providers: [ClientsService],
  exports: [ClientsService, TypeOrmModule],
})
export class ClientsModule {}

@Module({
  imports: [TypeOrmModule.forFeature([UserSession, Client])],
  providers: [UserSessionsService],
  exports: [UserSessionsService, TypeOrmModule],
})
export class SessionsModule {}

@Module({
  imports: [TypeOrmModule.forFeature([AuthorizationGrant])],
  providers: [GrantsService],
  exports: [GrantsService, TypeOrmModule],
})
export class GrantsModule {}