import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './client.entity';
import { OidcError } from '../common/oidc-errors';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
  ) {}

  async validateClient(clientId: string, tenantId: string): Promise<Client> {
    if (!/^[a-z0-9-]+$/.test(clientId)) {
      throw new UnauthorizedException(
        OidcError.invalidClient('client_id com formato inválido'),
      );
    }

    const client = await this.clientRepository.findOne({
      where: { clientId, active: true },
      relations: ['redirectUris'],
    });

    if (!client) {
      throw new UnauthorizedException(
        OidcError.invalidClient('client_id não encontrado ou inativo'),
      );
    }

    if (client.tenantId !== tenantId) {
      throw new UnauthorizedException(
        OidcError.unauthorizedClient('client não pertence a este tenant'),
      );
    }

    return client;
  }

  validateRedirectUri(
    client: Client,
    redirectUri: string,
    type: 'login' | 'logout',
  ): void {
    this.validateRedirectUriFormat(redirectUri);

    const valid = client.redirectUris.some(
      (redirectUriEntity) =>
        redirectUriEntity.uriType === type && redirectUriEntity.uri === redirectUri,
    );

    if (!valid) {
      throw new BadRequestException(
        OidcError.invalidRequest('redirect_uri não registrada para este client'),
      );
    }
  }

  private validateRedirectUriFormat(uri: string): void {
    if (uri.length > 500) {
      throw new BadRequestException(
        OidcError.invalidRequest('redirect_uri muito longa'),
      );
    }

    let parsed: URL;

    try {
      parsed = new URL(uri);
    } catch {
      throw new BadRequestException(
        OidcError.invalidRequest('redirect_uri inválida'),
      );
    }

    if (!parsed.hostname || parsed.hostname.length < 3) {
      throw new BadRequestException(
        OidcError.invalidRequest('redirect_uri inválida'),
      );
    }

    const isLocalhost =
      parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    const isHttps = parsed.protocol === 'https:';
    const isHttpLocalhost = parsed.protocol === 'http:' && isLocalhost;

    if (!isHttps && !isHttpLocalhost) {
      throw new BadRequestException(
        OidcError.invalidRequest('redirect_uri deve usar HTTPS'),
      );
    }
  }
}