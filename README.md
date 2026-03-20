# ZonaDev Auth

Provedor de identidade (IdP) central da plataforma ZonaDev.

Responsabilidades principais:
- autenticacao de usuarios
- gestao de sessoes SSO
- emissao de JWT RS256 por audience (`aud`)
- controle administrativo de tenants, usuarios, planos, assinaturas e apps

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS + TypeScript + TypeORM |
| Banco | PostgreSQL |
| Cache/Infra apoio | Redis |
| Auth | JWT RS256 + Passport |
| Frontend | Next.js (SSR + proxy `/api`) |
| Email | Nodemailer + Handlebars |
| Container | Docker Compose |

## Estrutura de Pastas

```text
zonadev-auth/
 backend/
    src/
       modules/
          auth/              # login, oauth/token, logout, me, jwks, reset
          admin/             # stats e gestao de apps/acessos
          tenants/           # CRUD tenants
          users/             # CRUD usuarios + desativacao
          plans/             # CRUD planos
          subscriptions/     # licencas/assinaturas
          health/            # liveness/readiness
          app/               # cache de apps (aud/origin)
          redis/             # provider redis
       entities/              # entidades TypeORM
       guards/                # JwtAuthGuard e RolesGuard
       strategies/            # JwtStrategy
       database/
          migrations/
          seeds/
       common/                # enums, decorators, filtros, utils
    Dockerfile
    package.json
    .env.example
 frontend/
    app/
       login/
       forgot-password/
       reset-password/
       admin/
       api/[...path]/         # proxy para backend
    lib/
       api.ts
       api/server.ts
       auth.ts
    middleware.ts
    package.json
    .env.example
 docker-compose.yml
 README.md
```

## Fluxos do Sistema (estado atual)

### 1. Login e criacao de sessao

Arquivos:
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`

Sequencia:
1. Cliente envia `POST /auth/login` com `email`, `password`, `aud` e `redirect`.
2. Backend valida credenciais e estado do usuario/tenant/licenca.
3. Backend valida se usuario tem acesso ativo para o app (`user_app_access`).
4. Backend aplica limite de sessoes simultaneas (max 10), revogando a mais antiga quando necessario.
5. Backend salva hash SHA-256 do SID na tabela de sessoes e seta cookie `zonadev_sid`.
6. Backend responde com redirect seguro.

### 2. Token exchange por audience

Arquivos:
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/app/app-cache.service.ts`

Sequencia:
1. Cliente chama `GET /oauth/token?aud=<app-audience>` com cookie `zonadev_sid`.
2. Backend valida sessao ativa e expiracao.
3. Backend valida `aud` contra app ativa em cache.
4. Backend valida acesso do usuario a app.
5. Backend emite JWT RS256 e retorna `access_token`, `expires_in`, `default_role`.

### 3. Frontend admin protegido (SSR)

Arquivos:
- `frontend/middleware.ts`
- `frontend/lib/api/server.ts`
- `frontend/lib/auth.ts`

Sequencia:
1. Middleware protege `/admin/*`.
2. Se `admin_access_token` ausente/expirado, tenta exchange usando `zonadev_sid`.
3. Em sucesso, grava novo `admin_access_token` e continua.
4. Em falha, redireciona para `/login`.
5. Server Components chamam backend com Bearer token.

### 4. Proxy interno `/api/*`

Arquivos:
- `frontend/app/api/[...path]/route.ts`
- `frontend/lib/api.ts`

Sequencia:
1. Browser chama `/api/...` no frontend.
2. Route Handler encaminha para `API_URL` no backend.
3. Injeta `Authorization: Bearer <admin_access_token>` quando disponivel.
4. Repassa status, body e headers de volta ao browser.

### 5. Logout

Arquivo:
- `backend/src/modules/auth/auth.service.ts`

Sequencia:
1. `POST /auth/logout`.
2. Revoga sessao por hash de `zonadev_sid`.
3. Limpa cookie de sessao e cookies legados.
4. Retorna lista de URLs para logout local nas apps integradas.

## Pre-requisitos

- Node.js 20+ (recomendado)
- npm 10+ (ou pnpm se preferir)
- PostgreSQL 14+
- Redis 7+
- OpenSSL (para gerar chaves RSA)
- Docker e Docker Compose (opcional, para ambiente containerizado)

## Geracao de chaves RSA

Execute uma vez antes do primeiro bootstrap local:

```bash
mkdir -p backend/keys
openssl genrsa -out backend/keys/private.pem 2048
openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem
```

Importante:
- nunca commitar arquivos `.pem`
- em producao, usar secret manager

## Setup local (Backend e Frontend)

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run migration:run
npm run seed
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### Build de validacao

```bash
cd backend
npm run build

cd ../frontend
npm run build
```

## Variaveis de Ambiente

### Backend (`backend/.env`)

| Variavel | Descricao |
|---|---|
| `DATABASE_URL` | string de conexao PostgreSQL |
| `JWT_PRIVATE_KEY_PATH` | caminho chave privada RSA |
| `JWT_PUBLIC_KEY_PATH` | caminho chave publica RSA |
| `JWT_ACCESS_EXPIRES` | expiracao access token em segundos |
| `SESSION_EXPIRES` | expiracao da sessao em segundos |
| `JWT_KID` | identificador da chave no JWKS |
| `JWT_ISSUER` | claim `iss` dos tokens emitidos |
| `PORT` | porta da API NestJS |
| `NODE_ENV` | ambiente (`development`/`production`) |
| `DOMAIN` | dominio base para regras de redirect |
| `MAIL_HOST` | SMTP host |
| `MAIL_PORT` | SMTP porta |
| `MAIL_USER` | SMTP usuario |
| `MAIL_PASS` | SMTP senha |
| `MAIL_FROM` | remetente padrao |
| `SEED_ADMIN_PASSWORD` | senha do superadmin do seed |
| `HEALTH_CACHE_TTL_MS` | cache do health readiness |
| `HEALTH_TIMEOUT_MS` | timeout das verificacoes health |

Observacoes:
- `JWT_ISSUER` deve ser consistente com o valor esperado no validador JWT.
- apps e origins permitidas nao dependem de env fixa; sao carregadas da tabela `apps` e cacheadas.

### Frontend (`frontend/.env.local`)

| Variavel | Descricao |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL do backend para chamadas do cliente |
| `JWT_EXPECTED_ISS` | issuer esperado (uso server-side) |
| `JWT_EXPECTED_AUD` | audience esperada (uso server-side) |
| `API_URL` | URL interna do backend para SSR/proxy (normalmente em docker) |

## Endpoints da API (completo)

### Auth e SSO

| Metodo | Endpoint | Auth | Rate limit |
|---|---|---|---|
| `POST` | `/auth/login` | Publico | 10 req / 15 min |
| `GET` | `/oauth/token` | Sessao (`zonadev_sid`) | 60 req / min |
| `POST` | `/auth/logout` | Sessao | 20 req / min |
| `POST` | `/auth/forgot-password` | Publico | 5 req / 15 min |
| `POST` | `/auth/reset-password` | Publico | padrao global |
| `GET` | `/auth/verify-email` | Publico | padrao global |
| `GET` | `/auth/me` | JWT | sem throttle |
| `GET` | `/.well-known/jwks.json` | Publico | sem throttle |

### Health

| Metodo | Endpoint | Auth |
|---|---|---|
| `GET` | `/health` | Publico |
| `GET` | `/health/ready` | Publico |

### Admin (SUPERADMIN)

| Metodo | Endpoint | Auth |
|---|---|---|
| `GET` | `/admin/stats` | JWT + SUPERADMIN |
| `POST` | `/admin/users/:id/kill-sessions` | JWT + SUPERADMIN |
| `GET` | `/admin/users/:id/app-access` | JWT + SUPERADMIN |
| `POST` | `/admin/users/:id/app-access` | JWT + SUPERADMIN |
| `GET` | `/admin/apps` | JWT + SUPERADMIN |
| `POST` | `/admin/apps` | JWT + SUPERADMIN |
| `PATCH` | `/admin/apps/:id` | JWT + SUPERADMIN |
| `POST` | `/admin/apps/reload` | JWT + SUPERADMIN |

### Tenants (SUPERADMIN)

| Metodo | Endpoint | Auth |
|---|---|---|
| `GET` | `/tenants` | JWT + SUPERADMIN |
| `GET` | `/tenants/:id` | JWT + SUPERADMIN |
| `GET` | `/tenants/:id/users` | JWT + SUPERADMIN |
| `POST` | `/tenants` | JWT + SUPERADMIN |
| `PUT` | `/tenants/:id` | JWT + SUPERADMIN |
| `DELETE` | `/tenants/:id` | JWT + SUPERADMIN |

### Users (SUPERADMIN, ADMIN com escopo)

| Metodo | Endpoint | Auth |
|---|---|---|
| `GET` | `/users` | JWT + SUPERADMIN/ADMIN |
| `GET` | `/users/:id` | JWT + SUPERADMIN/ADMIN |
| `POST` | `/users` | JWT + SUPERADMIN/ADMIN |
| `PATCH` | `/users/:id/deactivate` | JWT + SUPERADMIN/ADMIN |
| `DELETE` | `/users/:id` | JWT + SUPERADMIN/ADMIN |

### Plans

| Metodo | Endpoint | Auth |
|---|---|---|
| `GET` | `/plans` | Publico |
| `POST` | `/plans` | JWT + SUPERADMIN |
| `PUT` | `/plans/:id` | JWT + SUPERADMIN |

### Subscriptions

| Metodo | Endpoint | Auth |
|---|---|---|
| `GET` | `/subscriptions` | JWT + SUPERADMIN/ADMIN |
| `POST` | `/subscriptions` | JWT + SUPERADMIN/ADMIN |
| `PUT` | `/subscriptions/:id/cancel` | JWT + SUPERADMIN |
| `PUT` | `/subscriptions/:id/suspend` | JWT + SUPERADMIN |

## Estrutura do JWT (atual)

Token emitido no `GET /oauth/token`:

```json
{
  "sub": "uuid-user",
  "email": "user@empresa.com",
  "jti": "uuid-jti",
  "tenantId": "uuid-tenant-ou-null",
  "tenantSubdomain": "renowa",
  "plan": "PRO",
  "roles": ["ADMIN"],
  "defaultRole": "ADMIN",
  "aud": "renowa.zonadev.tech",
  "iss": "https://auth.zonadev.tech",
  "iat": 1710000000,
  "exp": 1710000900
}
```

Notas:
- `roles` esta em modo de compatibilidade temporaria.
- `tokenVersion` pode existir em tokens legados e deve ser tratado como opcional.

## Seguranca

### Protecoes de autenticacao

- bcrypt com custo 12
- anti timing attack com `DUMMY_HASH` quando usuario nao existe
- resposta generica no forgot-password (anti user enumeration)
- validacao de redirect seguro no backend
- JWT com assinatura RS256
- JWKS publico com cache (`max-age=300`)

### Sessao e revogacao

- cookie de sessao `zonadev_sid` httpOnly
- sessao persistida por hash SHA-256 do SID (nao guarda SID puro)
- limite de 10 sessoes por usuario
- logout revoga sessao e limpa cookies

### Validacao de token no backend

- JwtStrategy exige `sub` e `jti`
- valida `aud` esperada
- valida `iss` esperado
- nao valida `roles` no strategy (evita crash em tokens sem roles)

### CORS e isolamento

- CORS dinamico baseado em apps ativas (cache em memoria)
- `trust proxy` habilitado para IP real via reverse proxy
- health readiness com timeout e cache para evitar sobrecarga

## Decisoes Arquiteturais

1. Sessao primeiro, JWT por exchange:
   - reduz exposicao direta de token no login
   - facilita emissao por audience em apps diferentes

2. Registro de apps no banco:
   - audience e allowOrigin controlados por dados
   - permite onboarding de novos SaaS sem hardcode de CORS

3. Frontend SSR com proxy interno `/api`:
   - centraliza autenticacao no servidor Next
   - evita acoplamento forte do browser com backend externo

4. Compatibilidade controlada de roles:
   - `roles` reintroduzido no JWT temporariamente
   - estrategia final e migrar SaaS para RBAC local e remover claim

5. Health liveness/readiness separado:
   - liveness rapido para processo
   - readiness real para DB/Redis com timeout

## Audit Log

Acoes registradas (enum `AuditAction`):

| Evento | Descricao |
|---|---|
| `LOGIN_SUCCESS` | login concluido com sucesso |
| `LOGIN_FAILED` | falha de autenticacao |
| `LOGIN_BLOCKED_EMAIL_NOT_VERIFIED` | bloqueio por email nao verificado |
| `LOGOUT` | logout solicitado |
| `LICENSE_EXPIRED` | bloqueio por licenca/assinatura invalida |
| `TOKEN_REFRESHED` | evento legado de refresh |
| `PASSWORD_RESET` | senha alterada com sucesso |
| `TOKEN_REUSE_DETECTED` | tentativa de reutilizacao detectada |

Campos comuns gravados:
- acao
- userId (quando aplicavel)
- tenantId (quando aplicavel)
- ipAddress
- userAgent

## Docker Compose

Arquivo principal: `docker-compose.yml`

Servicos:
- `postgres`
- `redis`
- `migrate`
- `backend`
- `frontend`

Comandos comuns:

```bash
docker compose up -d --build
docker compose run --rm migrate
docker compose logs -f backend
```

## Troubleshooting rapido

### Loop de login

- validar cookie `zonadev_sid`
- validar resposta de `/oauth/token?aud=auth.zonadev.tech`
- validar emissao de `admin_access_token` no middleware

### 401 em rotas protegidas

- conferir consistencia `iss` entre emissao e validacao
- conferir `aud` esperada do servico
- conferir expiracao do token

### CORS bloqueado

- conferir app ativa na tabela `apps`
- conferir `allowOrigin` cadastrado
- recarregar cache via `POST /admin/apps/reload`

## Estado de Transicao

O sistema esta em transicao para RBAC local nos SaaS:
- hoje, JWT ainda inclui `roles` por compatibilidade
- JwtStrategy nao depende de `roles`
- objetivo final: remover `roles` do JWT apos migracao completa dos clientes

## Versao do documento

Atualizado em 2026-03-20 com base no codigo atual do repositorio.
