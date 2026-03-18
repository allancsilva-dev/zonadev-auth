# FASE 2 — SaaS: Permissões Locais + Auto-Provisioning

## Contexto

Fase 1 concluída: o Auth já emite zonadev_sid e responde em GET /oauth/token.
Agora cada SaaS implementa autorização local: local_users + permissions + role_permissions.

**PRÉ-REQUISITO:** Fase 1 validada (os 4 testes passaram).

## Metodologia

1. LER a estrutura existente do SaaS antes de criar qualquer arquivo
2. Migrations primeiro, depois entidades, depois guards/interceptors, depois controllers
3. `npm run build` ao final — zero erros TypeScript
4. Implementar para Renowa E ERP Nexos (mesma estrutura, dados diferentes)

---

## Etapa 2.1 — Migrations (aplicar em CADA SaaS)

Criar 3 tabelas no banco de cada SaaS (Renowa e ERP têm bancos separados).

**LER ANTES:** migrations existentes no SaaS para seguir o padrão.

### Tabela 1: local_users

```sql
CREATE TABLE local_users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID NOT NULL,
  tenant_id       UUID NOT NULL,
  email           VARCHAR(255) NOT NULL,
  role            VARCHAR(50) NOT NULL DEFAULT 'viewer',
  department      VARCHAR(100),
  active          BOOLEAN NOT NULL DEFAULT true,
  provisioned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at   TIMESTAMPTZ,

  UNIQUE(auth_user_id, tenant_id)
);

CREATE INDEX idx_local_users_tenant ON local_users(tenant_id);
CREATE INDEX idx_local_users_auth ON local_users(auth_user_id);
```

### Tabela 2: permissions

```sql
CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  module      VARCHAR(50) NOT NULL
);
```

### Tabela 3: role_permissions

```sql
CREATE TABLE role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role          VARCHAR(50) NOT NULL,
  permission_id UUID NOT NULL REFERENCES permissions(id),
  UNIQUE(role, permission_id)
);

CREATE INDEX idx_role_perms_role ON role_permissions(role);
```

---

## Etapa 2.2 — Seed de permissões

### Para o Renowa:

```sql
INSERT INTO permissions (slug, description, module) VALUES
  ('pedidos.criar', 'Criar novos pedidos', 'pedidos'),
  ('pedidos.ver', 'Visualizar pedidos', 'pedidos'),
  ('pedidos.editar', 'Editar pedidos existentes', 'pedidos'),
  ('pedidos.deletar', 'Remover pedidos', 'pedidos'),
  ('clientes.ver', 'Visualizar clientes', 'clientes'),
  ('clientes.editar', 'Editar clientes', 'clientes'),
  ('clientes.criar', 'Criar novos clientes', 'clientes');

-- Role: vendedor
INSERT INTO role_permissions (role, permission_id)
SELECT 'vendedor', id FROM permissions WHERE slug IN (
  'pedidos.criar', 'pedidos.ver', 'clientes.ver'
);

-- Role: viewer
INSERT INTO role_permissions (role, permission_id)
SELECT 'viewer', id FROM permissions WHERE slug IN (
  'pedidos.ver', 'clientes.ver'
);

-- Role: admin → acesso total (verificado no guard, não precisa de registros)
```

### Para o ERP Nexos:

```sql
INSERT INTO permissions (slug, description, module) VALUES
  ('nfe.emitir', 'Emitir nota fiscal', 'nfe'),
  ('nfe.ver', 'Visualizar notas fiscais', 'nfe'),
  ('estoque.baixar', 'Dar baixa no estoque', 'estoque'),
  ('estoque.ver', 'Visualizar estoque', 'estoque'),
  ('financeiro.ver', 'Visualizar financeiro', 'financeiro'),
  ('financeiro.aprovar', 'Aprovar pagamentos', 'financeiro'),
  ('relatorios.gerar', 'Gerar relatórios', 'relatorios');

-- Role: operador
INSERT INTO role_permissions (role, permission_id)
SELECT 'operador', id FROM permissions WHERE slug IN (
  'nfe.emitir', 'estoque.baixar', 'estoque.ver'
);

-- Role: fiscal
INSERT INTO role_permissions (role, permission_id)
SELECT 'fiscal', id FROM permissions WHERE slug IN (
  'nfe.ver', 'financeiro.ver', 'relatorios.gerar'
);

-- Role: gestor → acesso total (verificado no guard)
```

> Adaptar os slugs e módulos conforme a realidade do sistema. Estes são exemplos baseados no documento v2.1.

---

## Etapa 2.3 — Entidades TypeORM

Criar para cada SaaS: `LocalUser`, `Permission`, `RolePermission`.

**LocalUser:**
```typescript
@Entity('local_users')
export class LocalUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'auth_user_id' })
  authUserId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column()
  email: string;

  @Column({ default: 'viewer' })
  role: string;

  @Column({ nullable: true })
  department: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'provisioned_at' })
  provisionedAt: Date;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt: Date;
}
```

**Permission e RolePermission:** seguir a mesma estrutura, com as relações corretas.

---

## Etapa 2.4 — TenantAwareRepository

Criar em `src/common/repositories/tenant-aware.repository.ts`:

```typescript
import { Repository, FindManyOptions, FindOneOptions, DeepPartial, UpdateResult, DeleteResult } from 'typeorm';

export class TenantAwareRepository<T extends { tenantId: string }> {
  constructor(private readonly repo: Repository<T>) {}

  async findAll(tenantId: string, opts?: FindManyOptions<T>): Promise<T[]> {
    return this.repo.find({
      ...opts,
      where: { ...opts?.where, tenantId } as any,
    });
  }

  async findOne(tenantId: string, opts: FindOneOptions<T>): Promise<T | null> {
    return this.repo.findOne({
      ...opts,
      where: { ...opts.where, tenantId } as any,
    });
  }

  async save(tenantId: string, entity: DeepPartial<T>): Promise<T> {
    return this.repo.save({ ...entity, tenantId } as any);
  }

  async update(tenantId: string, id: string, partial: any): Promise<UpdateResult> {
    return this.repo.update({ id, tenantId } as any, partial);
  }

  async delete(tenantId: string, id: string): Promise<DeleteResult> {
    return this.repo.delete({ id, tenantId } as any);
  }
}
```

---

## Etapa 2.5 — TenantInterceptor

Criar em `src/common/interceptors/tenant.interceptor.ts`:

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant não identificado');
    }

    req.tenantId = tenantId;
    return next.handle();
  }
}
```

---

## Etapa 2.6 — AutoProvisionGuard

Criar em `src/guards/auto-provision.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalUser } from '../entities/local-user.entity';

@Injectable()
export class AutoProvisionGuard implements CanActivate {
  constructor(
    @InjectRepository(LocalUser)
    private readonly localUserRepo: Repository<LocalUser>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const jwt = req.user; // já validado pelo JwtGuard

    let localUser = await this.localUserRepo.findOne({
      where: {
        authUserId: jwt.sub,
        tenantId: jwt.tenantId,
      },
    });

    if (!localUser) {
      const mode = process.env.PROVISION_MODE ?? 'auto';

      if (mode === 'approval') {
        throw new ForbiddenException(
          'Acesso pendente de aprovação pelo administrador'
        );
      }

      // mode === 'auto': cria com role do user_app_access (definido pelo admin no Auth)
      localUser = await this.localUserRepo.save({
        authUserId: jwt.sub,
        tenantId: jwt.tenantId,
        email: jwt.email,
        role: jwt.defaultRole ?? 'viewer',  // vem do JWT, definido no user_app_access
        active: true,
      });
    }

    // Sync email se mudou no Auth
    if (localUser.email !== jwt.email) {
      await this.localUserRepo.update(localUser.id, { email: jwt.email });
      localUser.email = jwt.email;
    }

    // Registra último acesso
    await this.localUserRepo.update(localUser.id, { lastLoginAt: new Date() });

    req.localUser = localUser;
    return true;
  }
}
```

---

## Etapa 2.7 — PermissionGuard + RequirePermission

**Decorator** em `src/common/decorators/require-permission.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const RequirePermission = (...perms: string[]) =>
  SetMetadata('required_permissions', perms);
```

**Guard** em `src/guards/permission.guard.ts`:

```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePermission } from '../entities/role-permission.entity';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(RolePermission)
    private readonly rpRepo: Repository<RolePermission>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<string[]>(
      'required_permissions',
      context.getHandler(),
    );
    if (!required?.length) return true;

    const { localUser } = context.switchToHttp().getRequest();
    if (!localUser) return false;

    // Admin/gestor tem acesso total
    if (['admin', 'gestor'].includes(localUser.role)) return true;

    // Carrega permissões do role
    const userPerms = await this.rpRepo.find({
      where: { role: localUser.role },
      relations: ['permission'],
    });

    // Cache no request
    const req = context.switchToHttp().getRequest();
    req.permissions = userPerms.map(rp => rp.permission.slug);

    return required.every(p => req.permissions.includes(p));
  }
}
```

---

## Etapa 2.8 — Aplicar nos Controllers

**LER os controllers existentes** de cada SaaS. Adicionar os guards na ordem correta:

```typescript
@Controller('pedidos')
@UseGuards(JwtAuthGuard, AutoProvisionGuard, PermissionGuard)
@UseInterceptors(TenantInterceptor)
export class PedidosController {

  @Post()
  @RequirePermission('pedidos.criar')
  create(@Body() dto: CreatePedidoDto, @Req() req) {
    return this.pedidosService.create(dto, req.localUser, req.tenantId);
  }

  @Get()
  @RequirePermission('pedidos.ver')
  findAll(@Req() req) {
    return this.pedidosService.findAll(req.tenantId);
  }
}
```

> A ordem dos guards importa: JwtGuard → AutoProvisionGuard → PermissionGuard

---

## Etapa 2.9 — Endpoint local-logout

Em cada SaaS, criar endpoint para limpar cookie local (usado pelo logout cross-app):

**Para o ERP (Next.js + NestJS):**

No backend NestJS:
```typescript
@Post('auth/local-logout')
localLogout(@Res() res: Response) {
  res.clearCookie('erp_access_token', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    domain: 'erp.zonadev.tech',
    path: '/',
  });
  res.json({ success: true });
}
```

**Para o Renowa (SPA):**
Não precisa de endpoint — o token está em memória e é perdido no redirect.
Criar mesmo assim para consistência:
```typescript
@Post('auth/local-logout')
localLogout(@Res() res: Response) {
  res.json({ success: true });
}
```

---

## Etapa 2.10 — Variáveis de ambiente

**Renowa .env:** adicionar
```env
PROVISION_MODE=auto
```

**ERP .env:** adicionar
```env
PROVISION_MODE=approval
```

---

## Validação Final da Fase 2

```bash
npm run build  # ZERO erros TypeScript em cada SaaS
```

Testar:
1. Chamar endpoint protegido com JWT válido (do /oauth/token) → auto-provisioning cria local_user
2. Verificar que local_users tem tenant_id correto
3. Usuário com role 'viewer' tenta acessar endpoint com @RequirePermission('pedidos.criar') → deve retornar 403
4. Usuário com role 'admin' acessa qualquer endpoint → 200
5. ERP com PROVISION_MODE=approval → primeiro acesso retorna 403 "pendente de aprovação"

> **NÃO avançar para Fase 3 sem todos os testes passando.**
