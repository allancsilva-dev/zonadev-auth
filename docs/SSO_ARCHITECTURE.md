# ZonaDev SSO — Arquitetura para Novos Apps

## Visão geral

O Auth (auth.zonadev.tech) é o único provedor de identidade.
Nenhum app gerencia senha, sessão ou emite JWT — isso é exclusivo do Auth.

Fluxo obrigatório para qualquer novo app:

```text
1. Usuário acessa novo-app.zonadev.tech
2. Sem token válido → redireciona para auth.zonadev.tech/login?app=APP_AUD&redirect=URL
3. Usuário faz login no Auth
4. Auth cria sessão → seta cookie zonadev_sid (Domain=.zonadev.tech)
5. Auth redireciona de volta para o app
6. Middleware do app chama GET auth.zonadev.tech/oauth/token?aud=APP_AUD
7. Auth valida zonadev_sid → emite JWT (aud=APP_AUD, 15min)
8. Middleware seta cookie local (httpOnly, Domain=novo-app.zonadev.tech)
9. App usa JWT para chamar seu próprio backend
10. Backend valida JWT via JWKS (auth.zonadev.tech/.well-known/jwks.json)
```