# ZonaDev Auth SSO — Guia de Execução (v2)

## Mudança em relação à v1 dos prompts

Apps agora são DADO (tabela `apps` no banco), não configuração (.env).
CORS e audience são validados dinamicamente via cache in-memory.
Novo SaaS = INSERT no banco + reload cache. Sem rebuild, sem deploy do Auth.

## Estrutura dos Prompts

```
prompts-v2/
├── FASE_0_FIXES_IMEDIATOS.md   → 3 fixes sem código (10 min)
├── FASE_1_AUTH_SESSOES.md      → Auth: apps + sessions + app_access + /oauth/token (~5h)
├── FASE_2_SAAS_PERMISSOES.md   → SaaS: local_users + permissions + guards (~3h)
├── FASE_3_FRONTEND_SPA_SSR.md  → Frontend: Renowa (SPA) + ERP (SSR) (~3h)
└── FASE_4_LIMPEZA.md           → Remoção de código legado + testes (~1h)
```

## Como usar com Claude Code (VS Code)

### Regra principal
**Uma fase por vez. Não pular. Não paralelizar.**

### Fluxo de execução

1. Abrir o terminal Claude Code no VS Code
2. Copiar o conteúdo do arquivo da fase atual
3. Colar como prompt no Claude Code
4. Acompanhar a execução — intervir se necessário
5. Rodar os testes de validação listados no final de cada fase
6. Se TODOS passarem → avançar para próxima fase
7. Se algum falhar → corrigir ANTES de avançar

### Antes de cada fase

Confirmar com Claude Code:
> "Antes de fazer qualquer mudança, leia todos os arquivos mencionados neste prompt e me diga o que entendeu."

Isso garante que o Claude Code entende o contexto antes de editar.

### Se algo quebrar

Cada fase é independente. Se a Fase 2 quebrar:
1. Reverter via git (cada etapa deve ser um commit)
2. Verificar que a Fase 1 ainda funciona
3. Reenviar o prompt da Fase 2 com contexto do erro

## Ordem de Execução

```
Fase 0 → testar → Fase 1 → testar → Fase 2 → testar → Fase 3 → testar → Fase 4
```

Estimativa total: ~13h de trabalho (não contínuas).

## O que mudou na Fase 1 (principal diferença)

- Nova tabela `apps` (slug, audience, allow_origin, active)
- `user_app_access.app_id` é FK para `apps` (antes era `app_slug` string livre)
- `AppCacheService` carrega apps em memória e recarrega a cada 5min
- CORS dinâmico — valida origin contra cache, não .env
- `ALLOWED_AUDIENCES` e `ALLOWED_ORIGINS` removidos do .env
- Endpoints admin para CRUD de apps + reload de cache
- Novo SaaS = POST /admin/apps + pronto (sem rebuild)

## Referência

Documento completo: ZonaDev_Auth_SSO_v2.1_Final.docx
