import { DataSource } from 'typeorm';
import { Client } from '../../clients/client.entity';
import { ClientRedirectUri } from '../../clients/client-redirect-uri.entity';
import { Tenant } from '../../entities/tenant.entity';

export async function seedOidcClients(dataSource: DataSource): Promise<void> {
  const clientRepo = dataSource.getRepository(Client);
  const uriRepo = dataSource.getRepository(ClientRedirectUri);
  const tenantRepo = dataSource.getRepository(Tenant);

  const tenantErp = await tenantRepo.findOneOrFail({
    where: { subdomain: 'erp' },
  });

  const tenantRenowa = await tenantRepo.findOneOrFail({
    where: { subdomain: 'renowa' },
  });

  const clients = [
    {
      clientId: 'erp-nexostech',
      name: 'ERP Nexostech',
      backChannelLogoutUri: 'https://erp.zonadev.tech/api/auth/backchannel-logout',
      grantTypes: ['authorization_code', 'refresh_token'],
      allowedScopes: ['openid', 'profile', 'email'],
      accessTokenTtl: 900,
      refreshTokenTtl: 604800,
      maxSessionsPerUser: 10,
      tenantId: tenantErp.id,
      active: true,
      redirectUris: [
        { uriType: 'login' as const, uri: 'https://erp.zonadev.tech/callback' },
        { uriType: 'logout' as const, uri: 'https://erp.zonadev.tech' },
      ],
    },
    {
      clientId: 'renowa',
      name: 'Sistema Renowa',
      backChannelLogoutUri: 'https://renowa.zonadev.tech/api/auth/backchannel-logout',
      grantTypes: ['authorization_code', 'refresh_token'],
      allowedScopes: ['openid', 'profile', 'email'],
      accessTokenTtl: 900,
      refreshTokenTtl: 604800,
      maxSessionsPerUser: 10,
      tenantId: tenantRenowa.id,
      active: true,
      redirectUris: [
        { uriType: 'login' as const, uri: 'https://renowa.zonadev.tech/callback' },
        { uriType: 'logout' as const, uri: 'https://renowa.zonadev.tech' },
      ],
    },
  ];

  for (const data of clients) {
    const { redirectUris, ...clientData } = data;

    await dataSource.transaction(async (manager) => {
      const txClientRepo = manager.getRepository(Client);
      const txUriRepo = manager.getRepository(ClientRedirectUri);

      await txClientRepo.upsert(clientData, {
        conflictPaths: ['clientId'],
        skipUpdateIfNoValuesChanged: false,
      });

      const saved = await txClientRepo.findOneOrFail({
        where: { clientId: clientData.clientId },
      });

      await txUriRepo.delete({ clientId: saved.id });
      await txUriRepo.save(
        redirectUris.map((uri) => ({ ...uri, clientId: saved.id })),
      );

      console.log(`[Seed] Client '${saved.clientId}' sincronizado`);
    });
  }
}