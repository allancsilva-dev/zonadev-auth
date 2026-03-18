# FASE 1 — Auth ZonaDev: Apps + Sessões + App Access + Token Exchange

## Contexto

Refatorando o Auth ZonaDev para SSO com Session Exchange.
Apps passam a ser DADO (tabela no banco), não configuração (.env).
O Auth deixa de emitir JWT como cookie global e passa a emitir zonadev_sid.
Cada SaaS troca esse sid por um JWT via GET /oauth/token.

**Repositório:** /opt/zonadev-auth (VPS) ou local
**Stack:** NestJS + TypeORM + PostgreSQL + Redis

## Metodologia

1. LER todos os arquivos afetados ANTES de modificar
2. Criar migrations primeiro, testar, depois implementar código
3. `npm run build` no final — zero erros TypeScript
4. NÃO alterar código que não está no escopo desta fase

---

## Etapa 1.1 — Migration: tabela apps

A tabela `apps` é a fonte única de verdade para aplicações registradas.
Substitui ALLOWED_AUDIENCES e ALLOWED_ORIGINS do .env.

```sql
CREATE TABLE apps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         VARCHAR(50) NOT NULL UNIQUE,     -- 'renowa', 'erp', 'admin'
  name         VARCHAR(100) NOT NULL,           -- 'Renowa', 'ERP Nexos'
  audience     VARCHAR(255) NOT NULL UNIQUE,    -- 'renowa.zonadev.tech'
  allow_origin TEXT NOT NULL,                   -- 'https://renowa.zonadev.tech'
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apps_audience ON apps(audience) WHERE active = true;
CREATE INDEX idx_apps_slug ON apps(slug) WHERE active = true;
```

**Entidade App:**
- `id: string` (UUID, PrimaryGeneratedColumn)
- `slug: string` (Column, unique)
- `name: string` (Column)
- `audience: string` (Column, unique)
- `allowOrigin: string` (Column, name: 'allow_origin')
- `active: boolean` (Column, default: true)
- `createdAt: Date` (CreateDateColumn)

---

## Etapa 1.2 — Seed: popular apps com dados atuais

Criar migration de seed (ou insert no seed script existente — LER como o projeto faz seeds hoje):

```sql
INSERT INTO apps (slug, name, audience, allow_origin) VALUES
  ('admin', 'ZonaDev Admin', 'auth.zonadev.tech', 'https://auth.zonadev.tech'),
  ('renowa', 'Renowa', 'renowa.zonadev.tech', 'https://renowa.zonadev.tech'),
  ('erp', 'ERP Nexos', 'erp.zonadev.tech', 'https://erp.zonadev.tech');
```

---

## Etapa 1.3 — Migration: tabela sessions

```sql
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(128) NOT NULL UNIQUE,
  ip_address  INET,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sessions_not_expired CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_user ON sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE revoked_at IS NULL;
```

**Entidade Session:**
- `id: string` (UUID)
- `userId: string` (ManyToOne → User)
- `user: User` (relation)
- `tokenHash: string` (Column, unique)
- `ipAddress: string` (Column, nullable)
- `userAgent: string` (Column, nullable)
- `expiresAt: Date` (Column)
- `revokedAt: Date` (Column, nullable)
- `createdAt: Date` (CreateDateColumn)

---

## Etapa 1.4 — Migration: tabela user_app_access (com FK para apps)

```sql
CREATE TABLE user_app_access (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id       UUID NOT NULL REFERENCES apps(id),
  default_role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  status       VARCHAR(20) NOT NULL DEFAULT 'active',
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by   UUID REFERENCES users(id),
  revoked_at   TIMESTAMPTZ,

  UNIQUE(user_id, app_id)
);

CREATE INDEX idx_uaa_user ON user_app_access(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_uaa_app ON user_app_access(app_id) WHERE revoked_at IS NULL;
```

> NOTA: usa `app_id` (FK real para apps) em vez de `app_slug` (string livre).
> Isso garante integridade referencial — impossível conceder acesso a app inexistente.

**Entidade UserAppAccess:**
- `id: string` (UUID)
- `userId: string` (ManyToOne → User)
- `appId: string` (ManyToOne → App)
- `app: App` (relation)
- `defaultRole: string` (default: 'viewer')
- `status: string` (default: 'active') — 'pending', 'active', 'suspended'
- `grantedAt: Date`
- `grantedBy: string` (nullable, ManyToOne → User)
- `revokedAt: Date` (nullable)

---

## Etapa 1.5 — Migration de dados: popular user_app_access

Popular user_app_access para usuários existentes usando os IDs da tabela apps:

```sql
-- SUPERADMIN → acesso ao admin
INSERT INTO user_app_access (user_id, app_id, default_role, status)
SELECT u.id, a.id, 'admin', 'active'
FROM users u, apps a
WHERE u.roles @> ARRAY['SUPERADMIN'] AND a.slug = 'admin';

-- Usuários com tenant → acesso ao Renowa
INSERT INTO user_app_access (user_id, app_id, default_role, status)
SELECT u.id, a.id, 'viewer', 'active'
FROM users u, apps a
WHERE u.tenant_id IS NOT NULL AND a.slug = 'renowa';

-- Usuários com tenant → acesso ao ERP
INSERT INTO user_app_access (user_id, app_id, default_role, status)
SELECT u.id, a.id, 'viewer', 'active'
FROM users u, apps a
WHERE u.tenant_id IS NOT NULL AND a.slug = 'erp';
```

> Adaptar os SELECTs conforme a estrutura real da tabela users. LER a entidade User primeiro.

---

## Etapa 1.6 — AppCacheService (CORS dinâmico + validação de audience)

Criar `src/modules/app/app-cache.service.ts`:

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { App } from '../../entities/app.entity';

@Injectable()
export class AppCacheService implements OnModuleInit {
  private readonly logger = new Logger(AppCacheService.name);

  // Cache in-memory — recarregado a cada 5 minutos
  private appsByAudience = new Map<string, App>();
  private allowedOrigins = new Set<string>();

  constructor(
    @InjectRepository(App)
    private readonly appRepo: Repository<App>,
  ) {}

  async onModuleInit() {
    await this.reload();
    // Recarrega a cada 5 minutos
    setInterval(() => this.reload(), 5 * 60 * 1000);
  }

  async reload(): Promise<void> {
    const apps = await this.appRepo.find({ where: { active: true } });

    const byAud = new Map<string, App>();
    const origins = new Set<string>();

    for (const app of apps) {
      byAud.set(app.audience, app);
      origins.add(app.allowOrigin);
    }

    this.appsByAudience = byAud;
    this.allowedOrigins = origins;

    this.logger.log(`Cache reloaded: ${apps.length} apps`);
  }

  isValidAudience(aud: string): boolean {
    return this.appsByAudience.has(aud);
  }

  isAllowedOrigin(origin: string): boolean {
    return this.allowedOrigins.has(origin);
  }

  getAppByAudience(aud: string): App | undefined {
    return this.appsByAudience.get(aud);
  }

  getAppBySlug(slug: string): App | undefined {
    for (const app of this.appsByAudience.values()) {
      if (app.slug === slug) return app;
    }
    return undefined;
  }

  getAllowedOrigins(): string[] {
    return Array.from(this.allowedOrigins);
  }
}
```

**Registrar** no módulo principal (AppModule) como provider global ou exportar do módulo App.

---

## Etapa 1.7 — CORS dinâmico (main.ts)

**LER main.ts antes.** Substituir o CORS estático pelo dinâmico usando AppCacheService.

```typescript
// main.ts
const appCacheService = app.get(AppCacheService);

app.enableCors({
  origin: (origin, callback) => {
    // Requests sem origin (server-to-server, curl) → permitir
    if (!origin) return callback(null, true);

    if (appCacheService.isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

> NOTA: O AppCacheService precisa estar inicializado antes do enableCors.
> Garantir que o módulo que contém AppCacheService é importado no AppModule.

---

## Etapa 1.8 — Endpoint GET /oauth/token (usa tabela apps)

**LER:** `auth.controller.ts` e `auth.service.ts`

**No controller:**

```typescript
@Get('oauth/token')
@HttpCode(HttpStatus.OK)
@Throttle({ default: { limit: 60, ttl: 60_000 } })
async issueAppToken(
  @Query('aud') aud: string,
  @Req() req: Request,
  @Res() res: Response,
) {
  return this.authService.issueAppToken(aud, req, res);
}
```

**No service — injetar AppCacheService no construtor:**

```typescript
constructor(
  // ... dependências existentes ...
  private readonly appCacheService: AppCacheService,
  @InjectRepository(Session) private readonly sessionRepo: Repository<Session>,
  @InjectRepository(UserAppAccess) private readonly uaaRepo: Repository<UserAppAccess>,
) {
  // ... inicialização existente ...
}
```

**Implementar issueAppToken:**

```typescript
async issueAppToken(aud: string, req: Request, res: Response): Promise<void> {
  // 1. Extrai zonadev_sid
  const sid = req.cookies?.zonadev_sid;
  if (!sid) throw new UnauthorizedException('Sessão ausente');

  // 2. Valida sessão no banco
  const session = await this.sessionRepo.findOne({
    where: { tokenHash: sha256(sid), revokedAt: IsNull() },
    relations: ['user', 'user.tenant'],
  });
  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedException('Sessão expirada');
  }

  // 3. Valida audience contra tabela apps (via cache)
  const app = this.appCacheService.getAppByAudience(aud);
  if (!app) {
    throw new UnauthorizedException('Aplicação não autorizada');
  }

  // 4. Verifica user_app_access (status DEVE ser 'active')
  const access = await this.uaaRepo.findOne({
    where: {
      userId: session.user.id,
      appId: app.id,
      status: 'active',
      revokedAt: IsNull(),
    },
  });
  if (!access) {
    throw new UnauthorizedException('Sem acesso a esta aplicação');
  }

  // 5. Verifica user.active e tenant.active
  if (!session.user.active) {
    throw new UnauthorizedException('Usuário desativado');
  }
  if (session.user.tenant && !session.user.tenant.active) {
    throw new UnauthorizedException('Tenant desativado');
  }

  // 6. Valida subscription (se user tem tenant)
  if (session.user.tenantId) {
    const subscription = await this.subscriptionRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId: session.user.tenantId })
      .andWhere('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('s.expires_at > now()')
      .getOne();

    if (!subscription) {
      throw new UnauthorizedException('Licença expirada');
    }
  }

  // 7. Emite JWT (SEM roles de app — defaultRole é sugestão para auto-provisioning)
  const jti = uuidv4();
  const jwt = this.jwtService.sign(
    {
      sub: session.user.id,
      email: session.user.email,
      jti,
      tenantId: session.user.tenantId,
      tenantSubdomain: session.user.tenant?.subdomain ?? null,
      plan: session.user.tenant?.plan ?? null,
      defaultRole: access.defaultRole,  // sugestão do Auth → usado 1x no auto-provisioning
      aud,
    },
    {
      algorithm: 'RS256',
      expiresIn: this.accessExpires,
      header: { kid: this.jwtKid, alg: 'RS256' },
    },
  );

  res.json({
    access_token: jwt,
    expires_in: this.accessExpires,
    default_role: access.defaultRole,  // v2.1: SaaS usa no auto-provisioning
  });
}
```

---

## Etapa 1.9 — Refatorar Login

**LER:** método `login()` atual em `auth.service.ts` (código completo).

**Manter passos 1-4 intactos** (busca user, anti-timing, valida senha, verifica email).

**Substituir passo 5 (validação de audience):**

```typescript
// 5. Valida audience contra tabela apps
const app = this.appCacheService.getAppByAudience(dto.aud);
if (!app) {
  await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
  throw new UnauthorizedException('Aplicação não autorizada');
}
```

**Adicionar após passo 5 — verificar app_access:**

```typescript
// 5b. Verifica user_app_access
if (app.slug !== 'admin') {
  const appAccess = await this.uaaRepo.findOne({
    where: {
      userId: user.id,
      appId: app.id,
      status: 'active',
      revokedAt: IsNull(),
    },
  });
  if (!appAccess) {
    await this.audit(AuditAction.LOGIN_FAILED, ip, userAgent, user.id, user.tenantId ?? undefined);
    throw new UnauthorizedException('Sem acesso a esta aplicação');
  }
}
```

**Manter passos 6-8** (verifica active, tenant, subscription, LRU de sessões).

**Substituir passos 9-12** (geração de JWT e cookies) por:

```typescript
// 9. Cria sessão
const rawSid = generateToken(64);
const sidHash = sha256(rawSid);
const sessionExpires = new Date(Date.now() + this.sessionExpires * 1000);

await this.sessionRepo.save({
  userId: user.id,
  tokenHash: sidHash,
  ipAddress: ip,
  userAgent,
  expiresAt: sessionExpires,
});

// 10. Seta APENAS o session cookie
res.cookie('zonadev_sid', rawSid, {
  httpOnly: true,
  secure: this.isProduction,
  sameSite: 'lax',
  domain: this.isProduction ? '.zonadev.tech' : undefined,
  maxAge: this.sessionExpires * 1000,
  path: '/',
});

// 11. Audit + response (NÃO emitir access_token/refresh_token como cookie)
await this.audit(AuditAction.LOGIN_SUCCESS, ip, userAgent, user.id, user.tenantId ?? undefined);

const redirectUrl = isSafeRedirect(dto.redirect ?? '') ? dto.redirect! : SAFE_REDIRECT_FALLBACK;
res.json({ success: true, redirect: redirectUrl });
```

**Adicionar propriedade no construtor:**
```typescript
private readonly sessionExpires: number;
// No constructor body:
this.sessionExpires = Number(process.env.SESSION_EXPIRES ?? 604800);
```

**Remover do service:**
- `private readonly allowedAudiences: string[]` (substituído por AppCacheService)
- O método `isValidAudience()` antigo (substituído por `appCacheService.isValidAudience()`)

---

## Etapa 1.10 — Refatorar Logout (cross-app)

**Substituir o método logout() inteiro:**

```typescript
async logout(req: Request, res: Response): Promise<void> {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    ?? req.ip ?? 'unknown';
  const userAgent = req.headers['user-agent'] ?? 'unknown';

  const sid = req.cookies?.zonadev_sid;
  if (sid) {
    await this.sessionRepo.update(
      { tokenHash: sha256(sid) },
      { revokedAt: new Date() },
    );
  }

  // Limpar session cookie
  res.clearCookie('zonadev_sid', {
    httpOnly: true,
    secure: this.isProduction,
    sameSite: 'lax',
    domain: this.isProduction ? '.zonadev.tech' : undefined,
    path: '/',
  });

  // Limpar cookies antigos (retrocompatibilidade durante migração)
  const clearOld = {
    httpOnly: true,
    secure: this.isProduction,
    sameSite: 'none' as const,
    domain: this.isProduction ? '.zonadev.tech' : undefined,
  };
  res.clearCookie('access_token', clearOld);
  res.clearCookie('refresh_token', clearOld);

  const userId = (req as any).user?.sub;
  await this.audit(AuditAction.LOGOUT, ip, userAgent, userId);

  // Retorna logoutUrls dos SaaS para limpeza de cookies locais
  // Construir dinamicamente a partir da tabela apps
  const apps = await this.appRepo.find({ where: { active: true } });
  const logoutUrls = apps
    .filter(a => a.slug !== 'admin')
    .map(a => `${a.allowOrigin}/api/auth/local-logout`);

  res.json({ success: true, logoutUrls });
}
```

---

## Etapa 1.11 — Session Kill Global

No admin controller (LER para encontrar o arquivo correto):

```typescript
@Post('admin/users/:id/kill-sessions')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
async killSessions(@Param('id') userId: string) {
  await this.sessionRepo.update(
    { userId, revokedAt: IsNull() },
    { revokedAt: new Date() },
  );
  return { message: 'Todas as sessões revogadas' };
}
```

---

## Etapa 1.12 — App Access endpoints (admin)

```typescript
// GET /admin/users/:id/app-access
@Get('admin/users/:id/app-access')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
async getAppAccess(@Param('id') userId: string) {
  const accesses = await this.uaaRepo.find({
    where: { userId, revokedAt: IsNull() },
    relations: ['app'],
  });
  return { data: accesses };
}

// POST /admin/users/:id/app-access
// Body: { appSlug: string, action: 'grant' | 'revoke', defaultRole?: string }
@Post('admin/users/:id/app-access')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
async manageAppAccess(
  @Param('id') userId: string,
  @Body() dto: ManageAppAccessDto,
  @CurrentUser() admin: JwtPayload,
) {
  const app = this.appCacheService.getAppBySlug(dto.appSlug);
  if (!app) throw new BadRequestException('App não encontrada');

  if (dto.action === 'grant') {
    await this.uaaRepo.save({
      userId,
      appId: app.id,
      defaultRole: dto.defaultRole ?? 'viewer',
      status: 'active',
      grantedBy: admin.sub,
    });
  } else {
    await this.uaaRepo.update(
      { userId, appId: app.id },
      { revokedAt: new Date() },
    );
  }
  return { success: true };
}
```

Criar DTO `ManageAppAccessDto` (class-validator ou zod — seguir padrão do projeto):
- `appSlug: string` (required)
- `action: 'grant' | 'revoke'` (required)
- `defaultRole?: string` (optional)

---

## Etapa 1.13 — Apps CRUD endpoints (admin)

Criar endpoints para gerenciar apps registradas:

```typescript
// GET /admin/apps — listar apps
@Get('admin/apps')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
async listApps() {
  const apps = await this.appRepo.find({ order: { createdAt: 'ASC' } });
  return { data: apps };
}

// POST /admin/apps — registrar nova app
@Post('admin/apps')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
async createApp(@Body() dto: CreateAppDto) {
  const app = await this.appRepo.save(dto);
  // Recarrega cache imediatamente
  await this.appCacheService.reload();
  return { data: app };
}

// PATCH /admin/apps/:id — atualizar app
@Patch('admin/apps/:id')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
async updateApp(@Param('id') id: string, @Body() dto: UpdateAppDto) {
  await this.appRepo.update(id, dto);
  await this.appCacheService.reload();
  return { success: true };
}

// POST /admin/apps/reload — forçar recarga do cache
@Post('admin/apps/reload')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
async reloadCache() {
  await this.appCacheService.reload();
  return { success: true };
}
```

Criar DTOs:
- `CreateAppDto`: slug, name, audience, allowOrigin (todos required)
- `UpdateAppDto`: name?, audience?, allowOrigin?, active? (todos optional)

---

## Etapa 1.14 — Limpar .env

**Remover do .env do Auth** (agora vêm do banco):
```
# REMOVER estas linhas:
ALLOWED_AUDIENCES=...
ALLOWED_ORIGINS=...
```

**Remover do docker-compose.yml do Auth** (na seção environment do backend):
```yaml
# REMOVER:
ALLOWED_AUDIENCES: ${ALLOWED_AUDIENCES}
ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}
```

**Adicionar ao .env** (se ainda não existir):
```env
SESSION_EXPIRES=604800
```

---

## Etapa 1.15 — Atualizar CORS no docker-compose

Como o CORS agora é dinâmico (via AppCacheService), o docker-compose não precisa passar ALLOWED_ORIGINS. Mas o main.ts precisa ter acesso ao AppCacheService antes do `app.listen()`.

Verificar que a ordem de inicialização está correta:
1. NestJS inicializa módulos (AppCacheService.onModuleInit carrega cache)
2. main.ts pega AppCacheService via `app.get(AppCacheService)`
3. `app.enableCors(...)` usa o cache
4. `app.listen()`

---

## Validação Final da Fase 1

```bash
npm run build  # ZERO erros TypeScript
```

Rodar migrations:
```bash
docker compose run --rm migrate
```

Verificar seed:
```bash
docker compose exec postgres psql -U zerodev_admin -d zonadev_db \
  -c "SELECT slug, audience, allow_origin FROM apps;"
```

Deve retornar 3 linhas (admin, renowa, erp).

Testar endpoints:
1. POST /auth/login com `aud: "renowa.zonadev.tech"` → zonadev_sid setado, sem access_token cookie
2. GET /oauth/token?aud=renowa.zonadev.tech com cookie zonadev_sid → `{ access_token, expires_in }`
3. GET /oauth/token?aud=inexistente.zonadev.tech → 401 "Aplicação não autorizada"
4. POST /auth/logout → zonadev_sid limpo, logoutUrls retornado
5. GET /oauth/token sem cookie → 401

Testar CORS dinâmico:
6. Request com Origin: https://renowa.zonadev.tech → CORS aceita
7. Request com Origin: https://malicious.com → CORS rejeita

Testar admin:
8. GET /admin/apps → lista 3 apps
9. POST /admin/apps com nova app → app criada
10. POST /admin/apps/reload → cache recarregado
11. Request com novo origin → CORS aceita (sem rebuild!)

> **NÃO avançar para Fase 2 sem TODOS os testes passando.**
