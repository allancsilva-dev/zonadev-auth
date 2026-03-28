# @zonadev/auth-sdk (prototype)

Minimal SDK skeleton for ZonaDev authentication middleware and helpers.

Installation

  npm install @zonadev/auth-sdk

Envs

- `AUTH_URL` — URL of the auth server (e.g. https://auth.zonadev.tech)
- `APP_AUD` — audience for this app (e.g. erp.zonadev.tech)
- `APP_COOKIE_NAME` — cookie name used for access token
- `APP_URL` — public URL of the app (used as redirect base)
- `COOKIE_DOMAIN` — optional cookie domain

Usage (Next.js middleware)

In your app's `middleware.ts`:

```ts
export { zonadevAuthMiddleware as default } from '@zonadev/auth-sdk';
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'] };
```

Notes

- This package contains only helpers and a middleware wrapper prototype. It intentionally does not implement
  authorization, tenant logic or persistent storage.
