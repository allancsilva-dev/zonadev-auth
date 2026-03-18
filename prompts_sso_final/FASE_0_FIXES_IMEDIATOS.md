# FASE 0 — Fixes Imediatos (sem refatoração)

## Contexto

Estou refatorando o ZonaDev Auth para SSO Multi-SaaS (documento v2.1 Final).
ANTES de qualquer mudança arquitetural, preciso aplicar 3 fixes que resolvem os problemas atuais.

## Regras

- LER os arquivos antes de modificar
- NÃO alterar nada além do especificado
- Cada fix é independente — aplicar e testar um por vez

---

## Fix 1 — Issuer do ERP Nexos

**Problema:** O Auth emite JWT com `iss: "auth.zonadev.tech"`, mas o ERP valida contra `iss: "https://auth.zonadev.tech"` (com protocolo). A validação falha silenciosamente.

**Ação:**
1. Abrir o `.env` do backend do ERP Nexos
2. Localizar `AUTH_JWT_ISSUER`
3. Alterar de `https://auth.zonadev.tech` para `auth.zonadev.tech`

**Validação:** Reiniciar o container do ERP e verificar que o login funciona e as permissões são carregadas.

---

## Fix 2 — Porta do ERP Backend

**Problema:** O ERP expõe `ports: "3001:3001"` no docker-compose, mesma porta usada internamente pelo Auth backend. Pode causar conflito de roteamento.

**Ação:**
1. Abrir `docker-compose.yml` do ERP Nexos
2. Alterar `ports: - "3001:3001"` para `ports: - "3004:3001"`
3. NÃO alterar a porta interna do container (3001) — só a porta do host

**Validação:** `docker compose up -d` e verificar que o container sobe healthy.

---

## Fix 3 — Nginx Proxy Manager

**Problema:** Após mudar a porta do ERP para 3004, o NPM precisa ser atualizado.

**Ação:**
1. Acessar Nginx Proxy Manager UI
2. Editar o proxy host `api-erp.zonadev.tech`
3. Alterar destino de `:3001` para `:3004`
4. Salvar

**Validação:** `curl -I https://api-erp.zonadev.tech/api/v1/health` deve retornar 200.

---

## Teste final da Fase 0

Após os 3 fixes:
1. Login no ERP → usuário deve ter permissões corretas
2. Login no Renowa → sessão deve ser mantida (não desconectar após ação)
3. Login no ERP e Renowa ao mesmo tempo → ambos devem funcionar

> **IMPORTANTE:** Se o teste 2 falhar (Renowa ainda desconecta), o problema de colisão de cookies persiste e será resolvido na Fase 1. É esperado — os fixes da Fase 0 resolvem apenas o issuer e a porta.
