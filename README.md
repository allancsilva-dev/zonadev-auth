# ZonaDev Auth

Provedor de identidade e licenciamento centralizado para a plataforma SaaS multi-tenant ZonaDev.

Responsável por autenticar usuários e emitir tokens JWT (RS256) para todas as aplicações clientes (ex: Sistema Renowa), atuando como SSO central.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS (TypeScript) |
| Banco de Dados | PostgreSQL |
| Autenticação | JWT RS256 + Passport |
| ORM | TypeORM (migrations) |
| E-mail | Nodemailer + Handlebars |
| Frontend | Next.js + Tailwind CSS |
| Package Manager | pnpm (backend) / npm (frontend) |

---

## Fluxo SSO

```
1. Usuário acessa renowa.zonadev.tech
2. Não autenticado → redireciona para auth.zonadev.tech?aud=renowa.zonadev.tech&redirect=...
3. Usuário faz login na tela ZonaDev Auth
4. Auth valida credenciais (bcryptjs cost 12)
5. Auth valida tenant ativo + subscription ACTIVE + expires_at > now()
6. Auth gera JWT RS256 com jti + tokenVersion + aud
7. Auth gera refresh token aleatório — salva SHA-256 no banco
8. Tokens via cookie HTTP-only, Secure, SameSite=Lax, domain=.zonadev.tech
9. Redireciona para renowa.zonadev.tech
10. Aplicação cliente busca chave pública via JWKS (cacheado 5 min)
11. Valida assinatura RS256 + aud — sem consultar banco por request
```

---

## Estrutura de Pastas

```
zonadev-auth/
├── backend/
│   ├── keys/
│   │   ├── private.pem         ← NUNCA commitar — carregar via env
│   │   └── public.pem
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── modules/
│   │   │   ├── auth/           ← Login, refresh, logout, reset, JWKS
│   │   │   ├── tenants/        ← CRUD de tenants (SUPERADMIN)
│   │   │   ├── users/          ← CRUD de usuários
│   │   │   ├── plans/          ← Planos de assinatura
│   │   │   ├── subscriptions/  ← Licenças por tenant
│   │   │   ├── mail/           ← Templates Handlebars + Nodemailer
│   │   │   └── health/         ← GET /health com latência do banco
│   │   ├── entities/           ← TypeORM entities (6 tabelas)
│   │   ├── guards/             ← JWT, Roles, License
│   │   ├── strategies/         ← JWT Strategy RS256
│   │   ├── jobs/               ← Cleanup diário de refresh_tokens
│   │   ├── common/             ← Decorators, filters, utils, enums
│   │   └── database/
│   │       ├── migrations/     ← 9 migrations com índices otimizados
│   │       └── seeds/          ← SUPERADMIN + tenant ZonaDev
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── app/
    │   ├── login/              ← Tela de login
    │   ├── forgot-password/    ← Solicitar reset
    │   └── reset-password/     ← Redefinir com token
    └── .env.local.example
```

---

## Pré-requisitos

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- PostgreSQL 14+
- OpenSSL (para gerar as chaves RSA)

---

## Geração das Chaves RSA

Execute uma vez antes do primeiro setup:

```bash
mkdir -p backend/keys

# Gerar chave privada RSA 2048-bit
openssl genrsa -out backend/keys/private.pem 2048

# Extrair chave pública
openssl rsa -in backend/keys/private.pem -pubout -out backend/keys/public.pem
```

> **Importante:** nunca commite os arquivos `.pem`. Em produção, carregue via secrets manager e configure `JWT_PRIVATE_KEY_PATH` / `JWT_PUBLIC_KEY_PATH` no `.env`.

---

## Setup

### 1. Backend

```bash
cd backend

# Instalar dependências
pnpm install

# Copiar e configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Executar migrations (cria todas as tabelas e índices)
pnpm run migration:run

# Executar seed (cria SUPERADMIN + tenant ZonaDev)
pnpm run seed

# Iniciar em desenvolvimento
pnpm run start:dev

# Build e start em produção
pnpm run build
pnpm run start:prod
```

### 2. Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env.local
# Editar NEXT_PUBLIC_API_URL se necessário

# Iniciar em desenvolvimento
npm run dev

# Build e start em produção
npm run build
npm start
```

---

## Variáveis de Ambiente

### Estrutura

| Arquivo | Quando é carregado | Commitar? |
|---|---|---|
| `backend/.env` | `pnpm run start:dev` | ❌ Nunca |
| `backend/.env.production` | Deploy na Hostinger | ❌ Nunca |
| `backend/.env.example` | Documentação | ✅ Sempre |
| `frontend/.env.local` | `npm run dev` | ❌ Nunca |
| `frontend/.env.production` | `npm run build` | ❌ Nunca |
| `frontend/.env.example` | Documentação | ✅ Sempre |

### Setup inicial

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Preencher os valores reais nos arquivos copiados
```

### Ordem de prioridade — Next.js 14+

O Next.js carrega variáveis nesta ordem (maior prioridade primeiro):

1. `.env.local` — sempre carregado, sobrescreve qualquer outro
2. `.env.production` — carregado apenas no build (`NODE_ENV=production`)
3. `.env` — base, carregado sempre

> ⚠️ **Nunca manter `.env.local` no servidor de produção.**
> Se existir no servidor, ele sobrescreve `.env.production` silenciosamente —
> o `NEXT_PUBLIC_API_URL` apontaria para `localhost` em produção sem nenhum aviso.
> O `.env.local` é exclusivo para máquina de desenvolvimento.

### Variáveis server-side vs client-side (Next.js)

| Prefixo | Disponível em | Aparece no bundle? |
|---|---|---|
| `NEXT_PUBLIC_` | Client + Server | ✅ Sim |
| (sem prefixo) | Server apenas | ❌ Não |

`JWT_EXPECTED_ISS` e `JWT_EXPECTED_AUD` não têm `NEXT_PUBLIC_` — são usadas
apenas no middleware (Edge Runtime) e no `layout.tsx` (Server Component).
**Nunca usar essas variáveis em Client Components** — se isso for necessário
no futuro, adicionar `NEXT_PUBLIC_` e aceitar que irão para o bundle.

### Backend (`backend/.env`)

| Variável | Descrição | Exemplo |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_PRIVATE_KEY_PATH` | Caminho da chave privada RSA | `./keys/private.pem` |
| `JWT_PUBLIC_KEY_PATH` | Caminho da chave pública RSA | `./keys/public.pem` |
| `JWT_ACCESS_EXPIRES` | Expiração do access token (segundos) | `900` (15 min) |
| `JWT_REFRESH_EXPIRES` | Expiração do refresh token (segundos) | `604800` (7 dias) |
| `JWT_KID` | ID da chave RSA no JWKS | `zonadev-2026-01` |
| `JWT_ISSUER` | Emissor do JWT (claim `iss`) | `auth.zonadev.tech` |
| `PORT` | Porta do servidor | `3000` |
| `NODE_ENV` | Ambiente | `development` / `production` |
| `DOMAIN` | Domínio base (usado por `isSafeRedirect`) | `zonadev.tech` |
| `ALLOWED_AUDIENCES` | Sistemas autorizados a receber tokens (claim `aud`) | `renowa.zonadev.tech` |
| `ALLOWED_ORIGINS` | Origens permitidas no CORS | `http://localhost:3001,https://renowa.zonadev.tech` |
| `MAIL_HOST` | SMTP host | `smtp.example.com` |
| `MAIL_PORT` | SMTP porta | `587` |
| `MAIL_USER` | SMTP usuário | `noreply@zonadev.tech` |
| `MAIL_PASS` | SMTP senha | — |
| `MAIL_FROM` | Remetente padrão | `ZonaDev Auth <noreply@zonadev.tech>` |
| `SEED_ADMIN_PASSWORD` | Senha do SUPERADMIN criado no seed | — |
| `HEALTH_CACHE_TTL_MS` | Cache do endpoint /health (ms) | `5000` |
| `HEALTH_TIMEOUT_MS` | Timeout dos checks de banco/redis (ms) | `1500` |

---

## Configuração de Autenticação (Backend)

Esta secção documenta as variáveis de ambiente relacionadas com autenticação e as definições de runtime do serviço ZonaDev Auth.

| Variável | Descrição | Exemplo / Padrão |
|---|---|---|
| `JWT_PRIVATE_KEY_PATH` | Caminho para a chave RSA privada usada para assinar access tokens (RS256) | `./keys/private.pem` |
| `JWT_PUBLIC_KEY_PATH` | Caminho para a chave RSA pública exposta via JWKS | `./keys/public.pem` |
| `JWT_KID` | ID da chave usado no header do JWT e no JWKS | `zonadev-2026-01` |
| `JWT_ISSUER` | Claim `iss` presente nos tokens | `auth.zonadev.tech` |
| `JWT_ACCESS_EXPIRES` | Expiração do access token em segundos | `900` (15m) |
| `JWT_REFRESH_EXPIRES` | Expiração do refresh token em segundos | `604800` (7d) |
| `ALLOWED_AUDIENCES` | Lista separada por vírgula das audiences (`aud`) permitidas para clientes | `renowa.zonadev.tech,zonadev-admin` |
| `MAX_SESSIONS` | Máximo de sessões concorrentes por utilizador (evicção LRU) | `10` |
| `BCRYPT_ROUNDS` | Cost factor do bcrypt (hash de passwords) | `12` |
| `DOMAIN` | Domínio base usado para cookie domain e redirecionamentos seguros | `zonadev.tech` |
| `COOKIE_SECURE_IN_PROD` | Quando `NODE_ENV=production`, os cookies são marcados como `Secure` | `true` (automático) |

Notas:
- Os refresh tokens são armazenados hasheados (SHA-256) na tabela `refresh_tokens` e suportam persistência de `aud`, pelo que cada token fica ligado à audience do cliente.
- A rotação de refresh token é obrigatória: ao usar um token, o token antigo é revogado e um novo é criado. A deteção de reutilização revoga todas as sessões do utilizador.
- Cookies: `access_token` e `refresh_token` são definidos como `HttpOnly`, `SameSite=None; Secure` e usam o domínio `.zonadev.tech` em produção (necessário para SSO cross-origin).
- Verificação de e-mail e reset de password usam campos distintos na tabela `users` para evitar reutilização de tokens entre fluxos.


### Frontend (`frontend/.env.local` / `frontend/.env.production`)

| Variável | Prefixo | Descrição | Dev | Prod |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | `NEXT_PUBLIC_` | URL do backend NestJS | `http://localhost:3000` | `https://auth.zonadev.tech` |
| `JWT_EXPECTED_ISS` | — | Emissor esperado nos tokens JWT | `auth.zonadev.tech` | `auth.zonadev.tech` |
| `JWT_EXPECTED_AUD` | — | Audiência esperada (painel admin) | `zonadev-admin` | `zonadev-admin` |

---

## Endpoints da API

| Método | Endpoint | Auth | Rate Limit | Descrição |
|---|---|---|---|---|
| `POST` | `/auth/login` | — | 10/15min | Login com credenciais |
| `POST` | `/auth/refresh` | — | 30/min | Renovar tokens |
| `POST` | `/auth/logout` | — | 20/min | Encerrar sessão |
| `POST` | `/auth/forgot-password` | — | 5/15min | Solicitar reset de senha |
| `POST` | `/auth/reset-password` | — | — | Redefinir senha com token |
| `GET` | `/auth/verify-email` | — | — | Verificar e-mail via token |
| `GET` | `/.well-known/jwks.json` | — | Sem limite | Chave pública RSA (JWKS) |
| `GET` | `/health` | — | Sem limite | Status do serviço |
| `GET` | `/tenants` | SUPERADMIN | — | Listar tenants |
| `POST` | `/tenants` | SUPERADMIN | — | Criar tenant |
| `GET` | `/users` | ADMIN+ | — | Listar usuários |
| `POST` | `/users` | ADMIN+ | — | Criar usuário |
| `GET` | `/plans` | — | — | Listar planos |
| `GET` | `/subscriptions` | SUPERADMIN | — | Listar subscriptions |

---

## Estrutura do JWT

```json
{
  "sub": "user-uuid",
  "jti": "uuid-v4-aleatório",
  "tokenVersion": 1,
  "tenantId": "tenant-uuid",
  "tenantSubdomain": "renowa",
  "plan": "PRO",
  "roles": ["ADMIN", "VENDEDOR"],
  "iss": "auth.zonadev.tech",
  "aud": "renowa.zonadev.tech",
  "iat": 1700000000,
  "exp": 1700000900
}
```

---

## Segurança

### Autenticação
- Senhas: **bcryptjs** com custo mínimo 12
- JWT: **RS256** (RSA 2048-bit) — aplicações clientes validam sem consultar banco
- Refresh tokens: **SHA-256** do token aleatório (alta entropia, O(1), sem bcrypt)
- Reset de senha: **SHA-256** do token raw — token puro só no e-mail, nunca no banco

### Proteções
- **Anti-user-enumeration**: resposta idêntica para e-mail inexistente e senha errada
- **Anti-timing attack**: bcrypt executado mesmo quando usuário não existe (`DUMMY_HASH`)
- **Rate limiting**: por IP por endpoint (memória local — ver limitações)
- **Open Redirect**: `isSafeRedirect()` aceita apenas `*.zonadev.tech` no backend
- **Cookie HTTP-only**: tokens nunca acessíveis por JavaScript
- **Cookie domain condicional**: `.zonadev.tech` em produção, `undefined` em dev
- **Clock tolerance**: 60 segundos para JWT (RFC 7519) — tolerância a clock skew

### Sessões
- Máximo 10 sessões simultâneas por usuário (LRU — remove a mais antiga)
- Refresh token rotation: token revogado a cada uso
- Reuse detection: TOKEN_REUSE_DETECTED → revoga **todas** as sessões do usuário
- Troca de senha: `token_version + 1` → todas as sessões expiram no próximo refresh

### JWKS
- `GET /.well-known/jwks.json` — Cache-Control: `public, max-age=300`
- Rotação de chaves: processo documentado com 48h de coexistência via `kid`

---

## Decisões Arquiteturais

### Email único global (v1.0)
Emails são únicos globalmente na plataforma (não por tenant). Um mesmo email não pode existir em dois tenants.

**Caminho de migração futura:**
1. Remover `idx_users_email` (UNIQUE global)
2. Criar `UNIQUE (email, tenant_id)`
3. Ajustar login para receber tenant como critério de busca

### CORS estático (v1.0)
Origens CORS configuradas via `ALLOWED_ORIGINS` env var como lista estática separada por vírgula.

**v2.0:** Migrar para função dinâmica consultando tabela `applications` para suporte a domínios customizados (white-label).

### `aud` via env (v1.0)
Audiências configuradas via `ALLOWED_AUDIENCES`. Cada token carrega o `aud` do sistema cliente.

**v2.0:** Migrar para tabela `applications` com `domain`, `active`, `name`.

---

## Audit Log

Todas as ações sensíveis são registradas na tabela `audit_logs` com IP, user-agent, tenant e usuário.

| Evento | Quando ocorre |
|---|---|
| `LOGIN_SUCCESS` | Login bem-sucedido |
| `LOGIN_FAILED` | Senha incorreta |
| `LOGIN_BLOCKED_EMAIL_NOT_VERIFIED` | E-mail ainda não verificado |
| `LOGOUT` | Logout explícito |
| `TOKEN_REFRESHED` | Refresh token usado com sucesso |
| `TOKEN_REUSE_DETECTED` | Refresh token já revogado reusado — todas as sessões do usuário são encerradas |
| `LICENSE_EXPIRED` | Tentativa de login com subscription expirada |
| `PASSWORD_RESET` | Senha redefinida com sucesso |

---

## Cleanup Job

Um job agendado remove diariamente da tabela `refresh_tokens` os registros obsoletos para manter a performance das queries.

| Propriedade | Valor |
|---|---|
| Schedule | `0 2 * * *` (todo dia às 02:00) |
| Remove | tokens revogados (`revoked_at IS NOT NULL`) |
| Remove | tokens expirados (`expires_at < now()`) |

---

## Limitações Conhecidas

### Rate Limiting por instância
O `@nestjs/throttler` usa memória local. Em deployments multi-instância (Docker Swarm, Kubernetes), o limite é **por processo**, não global.

**Migração futura:**
```
pnpm add @nestjs-modules/throttler-storage-redis
```
Substituir o store padrão por Redis no `ThrottlerModule.forRoot()`.

---

## Rotação de Chaves RSA

| Passo | Ação |
|---|---|
| 1 | Gerar novo par RSA |
| 2 | Adicionar nova chave ao JWKS (2 chaves: antiga + nova) |
| 3 | Passar a assinar novos tokens com nova chave |
| 4 | Aguardar 48h (tokens antigos expiram em no máximo 15 min) |
| 5 | Remover chave antiga do JWKS |
| 6 | Atualizar `JWT_KID` no `.env` |

---

## Produção

- Servidor **obrigatoriamente sincronizado via NTP** (JWT depende de tempo)
- Chaves RSA em **secrets manager** (não em disco, não commitadas)
- `NODE_ENV=production` para ativar cookies `Secure` e domain `.zonadev.tech`
- Banco PostgreSQL com backup automático e connection pooling (PgBouncer recomendado)

---

*ZonaDev Auth v1.2 — Março 2026*

---

## Workflow de Deploy

### Local (antes de cada deploy)
```bash
cd backend
pnpm run migration:run  # aplica migrations pendentes na máquina local
git add .
git commit -m "..."
git push origin main
```

### VPS (após git push)
```bash
cd /opt/zonadev-auth
git pull origin main
docker compose build --no-cache backend
docker compose up -d
docker compose run --rm migrate pnpm run migration:run
```

> ⚠️ **Atenção — migrations na VPS**
> O container `migrate` pode reportar "No migrations are pending" mesmo quando
> as colunas não existem no banco, se os registos já estiverem na tabela `migrations`.
> Em caso de dúvida, verificar directamente:
> ```bash
> docker compose exec postgres psql -U zerodev_admin -d zonadev_db -c "\d users"
> ```
>
> Se as colunas não existirem, aplicar manualmente via SQL.

---

## Testes

Este repositório pode incluir testes unitários e de integração. Para executar os testes locais:

### Backend

```bash
cd backend
pnpm install
pnpm run test        # executa testes unitários, se existirem
pnpm run test:watch  # executa testes em modo watch durante desenvolvimento
```

### Frontend

```bash
cd frontend
npm install
npm run test
```

> Observação: se os scripts de teste não estiverem presentes, adicionar os comandos correspondentes ao `package.json` de cada pacote.

---

## Contribuição

Contribuições são bem-vindas. Procedimento recomendado:

- Abra uma issue descrevendo a alteração proposta.
- Crie um branch com nome descritivo: `feature/descricao` ou `fix/descricao`.
- Adicione testes para novas funcionalidades ou correções importantes.
- Execute `pnpm --filter ./backend run build` antes de abrir o PR.
- Garanta que migrations são adicionadas para mudanças no schema.

PR checklist mínima:

- Código formatado e lintado.
- Build do backend e frontend passam sem erros.
- Migrations e seeds atualizados quando necessário.

---

## Suporte / Contato

Para suporte, abra uma issue no repositório ou contacte a equipa responsável pelo projeto.

> Se as colunas não existirem, aplicar manualmente via SQL.

---

## Notas de mudanças recentes — Admin `/admin/stats` (2026-03-03)

Resumo das alterações e caminhos relevantes:

- Fix: `totalUsers` agora filtra `active: true` — `backend/src/modules/admin/admin.service.ts`
- Query agregada de `subscription` usando `FILTER` (reduz de 2 scans para 1) — `backend/src/modules/admin/admin.service.ts`
- `AdminStatsDto` com tipagem explícita — `backend/src/modules/admin/dto/admin-stats.dto.ts`
- Cache Redis (Keyv + KeyvRedis) com TTL 60s (ms) — `backend/src/modules/admin/admin.module.ts`
- Degradação graciosa: todas as operações Redis envoltas em `try/catch` — `backend/src/modules/admin/admin.service.ts`
- `isValidCache()` valida payload cacheado antes de retornar — `backend/src/modules/admin/admin.service.ts`
- Stampede protection: `SET NX` com UUID + Lua compare-and-delete — `backend/src/modules/admin/admin.service.ts` e `backend/src/modules/redis/redis.module.ts`
- Cache key namespaced/versioned: `zonadev:admin:stats:v1`
- Logger: cache hit/miss + slow query (>500ms) — `backend/src/modules/admin/admin.service.ts`
- Route throttling atualizado para Throttler v3+ — `backend/src/modules/admin/admin.controller.ts`
- `AdminService` exportado no `AdminModule` — `backend/src/modules/admin/admin.module.ts`
- Migration de índices adicionada — `backend/src/database/migrations/20260303_create_indexes_admin_stats.ts`
- TODO de cache invalidation documentado no service para futuras invalidações

Checklist: todos os itens acima foram implementados e o backend foi buildado com sucesso (`pnpm --filter ./backend run build`).

---

## Notas de mudanças recentes — Auth `/auth/*` (2026-03-03)

Resumo das alterações e caminhos relevantes:

- Race condition no refresh eliminada: revogação atómica com `UPDATE WHERE revoked_at IS NULL AND expires_at > NOW()` — `backend/src/modules/auth/auth.service.ts`
- Race condition no MAX_SESSIONS eliminada: transação com `SELECT ... FOR UPDATE` garante atomicidade total — `backend/src/modules/auth/auth.service.ts`
- `aud` persistido na tabela `refresh_tokens`: token rotation mantém a audience original do cliente — `backend/src/entities/refresh-token.entity.ts`
- `verifyEmail` usa campos dedicados `emailVerificationToken` / `emailVerificationExpires` — separados de `passwordResetToken` (fluxos distintos) — `backend/src/entities/user.entity.ts`
- `DUMMY_HASH` movido para propriedade estática da classe (`bcryptjs.hashSync` no bootstrap) — elimina dependência de hash hardcoded — `backend/src/modules/auth/auth.service.ts`
- Index `idx_users_email_verification_token` adicionado — `backend/src/entities/user.entity.ts`
- Migrations adicionadas: `20260303120000_auth_fixes.ts`, `20260303130000_add_index_email_verification_token.ts`
- Migration de índices Admin corrigida: nomes de tabelas (`subscription` → `subscriptions`, `"user"` → `users`) e timestamp da classe — `backend/src/database/migrations/20260303_create_indexes_admin_stats.ts`

⚠️ Pendente: o fluxo de registo de utilizadores ainda usa `passwordResetToken` para verificação de email.
Deve ser actualizado para usar `emailVerificationToken` / `emailVerificationExpires` antes de activar
o registo público de utilizadores.

Checklist: todos os itens acima foram implementados e o backend foi buildado com sucesso (`pnpm --filter ./backend run build`).

---

## Notas de mudanças recentes — Health / Mail / Plans (2026-03-03)

Resumo das alterações e melhorias de estabilidade:

### Health (`/health`)
- **Endpoints separados:**
  - `GET /health`: Liveness probe (rápido, apenas verifica se o serviço está de pé).
  - `GET /health/ready`: Readiness probe (verifica conexão com DB e Redis).
- **Resiliência:** Checks em paralelo com `Promise.race` e timeout configurável.
- **Cache:** Cache in-memory por instância (evita DoS no banco por health checks frequentes).
- **Env Vars:** `HEALTH_CACHE_TTL_MS` (padrão 5000ms) e `HEALTH_TIMEOUT_MS` (padrão 1500ms).

### Mail
- **Segurança:** Logs de erro sanitizados (evita vazar stack traces ou credenciais em logs de produção).
- **Configuração:** `MAIL_PORT` com validação numérica e detecção automática de `secure: true` para porta 465.

### Plans
- **Validação Rigorosa:** Implementados DTOs (`CreatePlanDto`, `UpdatePlanDto`) com `class-validator`.
- **Precisão:** Preço validado para máximo de 2 casas decimais.
- **Segurança:** `forbidNonWhitelisted: true` ativado globalmente (API rejeita campos desconhecidos no payload).

Checklist: todos os itens acima foram implementados e o backend foi buildado com sucesso (`pnpm --filter ./backend run build`).
---

## Workflow de Deploy

### Local (antes de cada deploy)
```bash
cd backend
pnpm run migration:run  # aplica migrations pendentes na máquina local
git add .
git commit -m "..."
git push origin main
```

### VPS (após git push)
```bash
cd /opt/zonadev-auth
git pull origin main
docker compose build --no-cache backend
docker compose up -d
docker compose run --rm migrate pnpm run migration:run
```

> ⚠️ **Atenção — migrations na VPS**
> O container `migrate` pode reportar "No migrations are pending" mesmo quando
> as colunas não existem no banco, se os registos já estiverem na tabela `migrations`.
> Em caso de dúvida, verificar directamente:
> ```bash
> docker compose exec postgres psql -U zerodev_admin -d zonadev_db -c "\d users"
> ```
> Se as colunas não existirem, aplicar manualmente via SQL.

---

## Notas de mudanças recentes — SSO cross-origin + Renowa (2026-03-08)

### Fix 6 — Senha com hash corrompido no banco (bash interpreta `$`)

O bash interpreta `$` como variável ao usar psql inline. Ao inserir hashes bcrypt, escapar com `\$`:

```bash
# ERRADO — bash expande $2b, $12 como variáveis
docker compose exec postgres psql -U zerodev_admin -d zonadev_db \
  -c "UPDATE users SET password_hash = '$2b$12$...' WHERE email = '...';"

# CORRETO
docker compose exec postgres psql -U zerodev_admin -d zonadev_db \
  -c "UPDATE users SET password_hash = '\$2b\$12\$...' WHERE email = '...';"
```

### Fix 7 — `roles[]` vs `role` mismatch (frontend/lib/auth.ts)

Backend retorna `roles: string[]` mas o frontend esperava `role: string`.
Corrigido em `frontend/lib/auth.ts`: deriva `role: data.roles?.[0] ?? 'USER'` ao retornar de `getMe()`.
Também corrigido `frontend/lib/jwt.ts`: `JwtPayload.role: string` → `roles: string[]`.

### Fix 8 — `SAFE_REDIRECT_FALLBACK` apontando para raiz

Alterado de `https://auth.zonadev.tech` para `https://auth.zonadev.tech/admin`
em `backend/src/common/utils/redirect.util.ts`.

### Fix 9 — SameSite cookie para SSO cross-origin

Cookies com `SameSite=Lax` não são enviados em requisições cross-origin via `fetch()`.
Alterado para `SameSite=None` em `backend/src/modules/auth/auth.service.ts` (linhas 86 e 394).

```typescript
// Para SSO multi-tenant (ex: renowa.zonadev.tech → auth.zonadev.tech)
sameSite: 'none' as const,  // NÃO 'lax'
secure: true,               // obrigatório com SameSite=None
domain: '.zonadev.tech',    // compartilha entre subdomínios
```

> `SameSite=None` só funciona com `Secure=true` — já configurado via `secure: this.isProduction`.

### Fix 10 — `ALLOWED_ORIGINS` faltando Renowa

Adicionado `https://renowa.zonadev.tech` no `.env`:

```
ALLOWED_ORIGINS=https://auth.zonadev.tech,https://renowa.zonadev.tech
```

---

## Notas de mudanças recentes — Sistema Renowa (2026-03-08)

### Fix Renowa 1 — ProtectedRoute race condition (frontend/src/App.tsx)

`isAuthenticated` do Zustand não atualizava a tempo após `setUser()` no mesmo ciclo de render.

```typescript
// ERRADO — depender do store no mesmo render
const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
if (!isAuthenticated) redirect();

// CORRETO — estado local controlado pelo useEffect
const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
// setAuthState('authenticated') após setUser(data) no .then()
```

### Fix Renowa 2 — Campo `nome` → `email` em AuthUser

`AuthUser` foi atualizado para refletir o retorno real de `/api/auth/me` (sem `nome`, com `email`).
Arquivos corrigidos:
- `frontend/src/types/index.ts`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/pages/Configuracoes.tsx`

### Fix Renowa 3 — Login pós-SSO usa `data.redirect` do backend

`frontend/app/login/page.tsx` do ZonaDev Auth: removida a chamada redundante a `/api/auth/me` pós-login.
O backend já retorna `{ success: true, redirect: string }` no `POST /auth/login`.

```typescript
const data = await res.json();
const target = data.redirect && isSafeRedirect(data.redirect)
  ? data.redirect
  : (redirect && isSafeRedirect(redirect) ? redirect : '/admin');
window.location.href = target;
```

---

## Padrões corretos estabelecidos em Março 2026

### Escape de hashes bcrypt no bash

```bash
# ERRADO
password_hash = '$2b$12$...'

# CORRETO
password_hash = '\$2b\$12\$...'
```

### Cookies para SSO multi-tenant

```typescript
sameSite: 'none' as const,  // NÃO 'lax' — necessário para cross-origin
secure: true,               // obrigatório com SameSite=None
domain: '.zonadev.tech',    // compartilha entre todos os subdomínios
```

### React SPA com auth externo — evitar race condition

```typescript
// ERRADO
const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
if (!isAuthenticated) redirect();

// CORRETO
const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'unauthenticated'>('checking');
// Só redireciona após o useEffect resolver
```

### ALLOWED_ORIGINS deve incluir todos os clientes SSO

Ao integrar uma nova aplicação cliente, adicionar seu domínio em `ALLOWED_ORIGINS` e em `ALLOWED_AUDIENCES`.
