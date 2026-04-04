import { Module } from '@nestjs/common';
import { ClientsModule, SessionsModule, GrantsModule } from '../oidc.modules';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

@Module({
  imports: [
    ClientsModule,
    SessionsModule,
    GrantsModule,
  ],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}