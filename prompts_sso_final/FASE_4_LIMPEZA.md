# FASE 4 — Limpeza e Validação Final

## Contexto

Fases 0-3 concluídas e testadas. O sistema SSO está funcional.
Esta fase remove código legado e valida que nada quebrou.

**PRÉ-REQUISITO:** Fase 3 validada com TODOS os testes cross-app passando.

## Metodologia

1. Cada remoção é um commit separado — se algo quebrar, reverte fácil
2. Testar após CADA remoção, não tudo no final
3. `npm run build` após cada etapa

---

## Etapa 4.1 — Remover POST /auth/refresh do Auth

**LER ANTES:** `auth.controller.ts` e `auth.service.ts`

1. Remover o endpoint `@Post('auth/refresh')` do controller
2. Remover o método `refresh()` do service
3. NÃO remover imports que são usados por outros métodos
4. `npm run build`

**Teste:** POST /auth/refresh → deve retornar 404

---

## Etapa 4.2 — Remover lógica de cookies JWT globais do Auth

**No auth.service.ts:**

1. Remover o método `getCookieOptions()` (se ninguém mais usa)
2. Verificar que o login NÃO seta `access_token` nem `refresh_token` como cookie
3. Verificar que o logout limpa os cookies antigos (manter a limpeza por retrocompatibilidade durante 1 sprint, depois remover)

---

## Etapa 4.3 — Avaliar remoção da tabela refresh_tokens

**CUIDADO:** Só remover se:
- Nenhum código referencia `RefreshToken` entity
- Nenhum endpoint usa `refreshTokenRepo`
- O `token reuse detection` foi migrado para a tabela `sessions`

Se ainda houver referências, NÃO remover. Marcar como TODO para o próximo sprint.

---

## Etapa 4.4 — Limpar variáveis de ambiente

Confirmar que foram removidos do `.env` e `docker-compose.yml` do Auth:
- `ALLOWED_AUDIENCES` (agora vem da tabela `apps`)
- `ALLOWED_ORIGINS` (agora vem da tabela `apps`)
- `JWT_REFRESH_EXPIRES` (se não usada por nenhum outro código)

Confirmar que estão presentes:
- `SESSION_EXPIRES=604800`

---

## Etapa 4.5 — Build final de todos os sistemas

```bash
# Auth
cd /opt/zonadev-auth && docker compose build --no-cache frontend backend

# Renowa (se monorepo)
cd /root/renowa && docker compose -f docker-compose.prod.yml build

# ERP
cd /root/erp-nexos && docker compose build
```

---

## Etapa 4.6 — Teste de regressão completo

### Auth:
- [ ] POST /auth/login → zonadev_sid setado, sem access_token cookie
- [ ] GET /oauth/token?aud=renowa.zonadev.tech → retorna JWT
- [ ] GET /oauth/token?aud=erp.zonadev.tech → retorna JWT
- [ ] GET /oauth/token?aud=inexistente.zonadev.tech → 401
- [ ] GET /oauth/token sem sid → 401
- [ ] POST /auth/logout → zonadev_sid limpo, logoutUrls retornado
- [ ] GET .well-known/jwks.json → chave pública
- [ ] POST /admin/users/:id/kill-sessions → sessões revogadas
- [ ] GET /admin/users/:id/app-access → lista de apps
- [ ] POST /auth/refresh → 404 (removido)
- [ ] GET /admin/apps → lista apps do banco
- [ ] POST /admin/apps (nova app) → registra + CORS aceita sem rebuild
- [ ] CORS com origin não registrado → rejeitado

### Renowa:
- [ ] Acesso sem sessão → redirect login
- [ ] Login → token exchange → dashboard
- [ ] F5 → re-fetch token → funciona
- [ ] Endpoint protegido com permissão → funciona para role correto
- [ ] Endpoint protegido → 403 para role sem permissão
- [ ] Logout → redirect login

### ERP:
- [ ] Acesso sem sessão → redirect login
- [ ] Login → middleware exchange → cookie scoped → dashboard
- [ ] Token expira → middleware re-fetcha → transparente
- [ ] Endpoint protegido → funciona para role correto
- [ ] Primeiro acesso → 403 "pendente aprovação" (PROVISION_MODE=approval)
- [ ] Logout → cookies limpos

### Cross-App:
- [ ] Login Renowa → abrir ERP → SSO automático
- [ ] Login ERP → abrir Renowa → SSO automático
- [ ] Logout Auth → ambos perdem acesso
- [ ] Sessões independentes (cookies isolados)
- [ ] DevTools: nenhum cookie access_token com Domain=.zonadev.tech

---

## Após conclusão

Commitar tudo, fazer push, pull na VPS, rebuild dos containers:

```bash
# Na VPS
cd /opt/zonadev-auth
git pull origin main
docker compose build --no-cache frontend backend
docker compose up -d

# Renowa
cd /root/renowa
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build

# ERP
cd /root/erp-nexos
git pull origin main
docker compose up -d --build
```

> **A refatoração SSO está completa quando TODOS os itens do teste de regressão passam.**
