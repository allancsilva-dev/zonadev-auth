# ZonaDev SSO - Arquitetura para Novos Apps

## Modelo SSO ZonaDev

```text
SSO centralizado com sessão única (zonadev_sid)
Token local por aplicação (COOKIE_NAME) emitido por token exchange
```

## Regras do fluxo de login

```text
1. O utilizador tenta aceder a uma rota protegida do app.

2. O middleware roda apenas nas rotas protegidas do app.
	Não roda em:
	- /login
	- /health
	- /api
	- /_next
	- /favicon.ico

3. Se existir token local válido:
	- o request segue normalmente

4. Se não existir token local e não existir zonadev_sid:
	- o middleware redireciona para:
	  https://auth.zonadev.tech/login?app=APP_AUD&redirect=PATHNAME

5. A página /login é pública.
	Ela envia POST /auth/login com:
	- email
	- password
	- aud
	- redirect

6. O backend Auth valida credenciais e permissões do app.

7. Em sucesso, o backend cria a sessão global e seta:
	- zonadev_sid
	- Domain=.zonadev.tech
	- httpOnly
	- sameSite=lax

8. O backend devolve o redirect seguro informado no login.

9. O browser volta para a rota protegida do app.

10. Nesse novo request, o middleware encontra zonadev_sid,
	 chama GET /oauth/token?aud=APP_AUD e recebe access_token.

11. O middleware seta o cookie local do app com:
	 - COOKIE_NAME
	 - httpOnly
	 - sameSite=lax
	 - path=/
	 - sem domain explícito no middleware

12. O middleware faz redirect para a mesma URL.

13. No request seguinte, o SSR já consegue ler o token local
	 e enviar Authorization: Bearer para o backend.
```

## Regra crítica de SSR

```text
Cookies setados no middleware NÃO estão disponíveis no mesmo request.

Por isso, após token exchange, o middleware deve sempre responder com redirect.
```

## Regras do fluxo de logout

```text
1. O utilizador dispara logout no frontend do app.

2. O frontend chama POST /api/auth/logout.

3. O backend Auth:
	- revoga a sessão associada ao zonadev_sid
	- revoga refresh tokens do utilizador, quando existirem
	- limpa o cookie global zonadev_sid

4. Sem post_logout_redirect_uri, o backend responde:
	{ success: true, logoutUrls: [...] }

5. O frontend chama cada URL de logout local recebida em logoutUrls.

6. Cada app expõe /api/auth/local-logout para limpar o seu cookie local.

7. Após os local logouts, o frontend navega para /login.

8. Com a sessão global removida e os cookies locais limpos,
	novos acessos a rotas protegidas voltam para o login central.
```

## Regras de redirect

```text
- O middleware redireciona para https://auth.zonadev.tech/login
- O parâmetro app recebe APP_AUD
- O parâmetro redirect recebe apenas o pathname atual
- O backend só devolve redirects seguros
- /login fica fora do matcher para evitar loop infinito
```

## Política de cookies

| Cookie | Domínio | Uso |
| --- | --- | --- |
| zonadev_sid | .zonadev.tech | sessão global do SSO |
| admin_access_token | host-only no app Auth | autenticação local do app Auth |
| erp_access_token | host-only no app ERP | autenticação local do app ERP |
| renowa_access_token | host-only no app Renowa | autenticação local do app Renowa |

## Configuração mínima por app

```env
APP_AUD=auth.zonadev.tech
COOKIE_NAME=admin_access_token
COOKIE_DOMAIN=auth.zonadev.tech
API_URL=http://zonadev-auth-backend:3001
```

## Docker (runtime)

```yaml
environment:
  - APP_AUD=auth.zonadev.tech
  - COOKIE_NAME=admin_access_token
  - COOKIE_DOMAIN=auth.zonadev.tech
  - API_URL=http://zonadev-auth-backend:3001
```

## Erros proibidos

```text
- Interceptar /login no matcher do middleware
- Tentar usar o cookie recém-setado no mesmo request SSR
- Compartilhar access_token entre apps
- Fazer auth client-side com localStorage ou sessionStorage
- Usar NEXT_PUBLIC_ para segredo, cookie ou regras de auth server-side
```

## Checklist para novo app

```text
[ ] Definir APP_AUD único
[ ] Definir COOKIE_NAME único
[ ] Implementar middleware apenas nas rotas protegidas
[ ] Excluir /login, /health, /api e /_next do matcher
[ ] Implementar token exchange com redirect pós-cookie
[ ] Implementar /api/auth/local-logout
[ ] Validar login, SSR e logout multi-app
```