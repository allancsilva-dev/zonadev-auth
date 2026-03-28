# ZonaDev SSO - Arquitetura para Novos Apps

## Modelo SSO ZonaDev

```text
SSO centralizado com sessão única (zonadev_sid)
Tokens locais por aplicação (access_token por subdomínio)
```

## Fluxo oficial

```text
1. Usuário faz login -> backend cria zonadev_sid
2. Browser armazena cookie (.zonadev.tech)

3. Usuário acessa app (ERP/Auth/etc)

4. Middleware:
	- lê zonadev_sid
	- chama /oauth/token?aud=APP_AUD
	- recebe access_token
	- seta cookie local (app-specific)

5. Middleware REDIRECT (obrigatório)

6. Novo request:
	- cookie local presente
	- SSR usa token
	- backend responde 200
```

## Regra crítica (SSR)

```text
Cookies setados no middleware NÃO estão disponíveis no mesmo request.

Sempre forçar redirect após token exchange.
```

## Política de cookies

| Cookie | Domínio | Uso |
| --- | --- | --- |
| zonadev_sid | .zonadev.tech | sessão global |
| admin_access_token | auth.zonadev.tech | Auth |
| erp_access_token | erp.zonadev.tech | ERP |
| renowa_access_token | renowa.zonadev.tech | Renowa |

## Configuração por app (.env)

```env
APP_AUD=auth.zonadev.tech
COOKIE_NAME=admin_access_token
COOKIE_DOMAIN=auth.zonadev.tech
```

## Docker (runtime obrigatório)

```yaml
environment:
  - APP_AUD=auth.zonadev.tech
  - COOKIE_NAME=admin_access_token
  - COOKIE_DOMAIN=auth.zonadev.tech
```

## Erros proibidos

```text
- Hardcode de domínio no código
- Usar NEXT_PUBLIC_ para cookie/auth
- Compartilhar access_token entre apps
- Tentar usar cookie no mesmo request SSR
```

## Checklist novo app

```text
[ ] Definir APP_AUD único
[ ] Definir COOKIE_NAME único
[ ] Definir COOKIE_DOMAIN correto
[ ] Implementar middleware com redirect pós-token
[ ] Implementar local-logout
[ ] Validar SSO com Auth + ERP
```