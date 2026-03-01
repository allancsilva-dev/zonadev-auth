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
│   │       ├── migrations/     ← 6 migrations com índices otimizados
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

# Configurar variável de ambiente
cp .env.local.example .env.local
# Editar NEXT_PUBLIC_API_URL

# Iniciar em desenvolvimento
npm run dev

# Build e start em produção
npm run build
npm start
```

---

## Variáveis de Ambiente

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
| `ALLOWED_ORIGINS` | Origens permitidas no CORS | `https://renowa.zonadev.tech` |
| `MAIL_HOST` | SMTP host | `smtp.example.com` |
| `MAIL_PORT` | SMTP porta | `587` |
| `MAIL_USER` | SMTP usuário | `noreply@zonadev.tech` |
| `MAIL_PASS` | SMTP senha | — |
| `MAIL_FROM` | Remetente padrão | `ZonaDev Auth <noreply@zonadev.tech>` |
| `SEED_ADMIN_PASSWORD` | Senha do SUPERADMIN criado no seed | — |

### Frontend (`frontend/.env.local`)

| Variável | Descrição | Exemplo |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL do backend ZonaDev Auth | `http://localhost:3000` |

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
  "role": "ADMIN",
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

*ZonaDev Auth v1.0 — Fevereiro 2026*
