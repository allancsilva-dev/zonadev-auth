import { Module } from '@nestjs/common';
import { ClientsModule, SessionsModule, GrantsModule } from '../oidc.modules';

@Module({
  imports: [
    ClientsModule,
    SessionsModule,
    GrantsModule,
  ],
  controllers: [],
  providers: [],
})
export class OAuthModule {}