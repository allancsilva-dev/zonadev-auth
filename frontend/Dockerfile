# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* são embutidas em tempo de build — precisam ser passadas como ARG
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS production

# wget para healthcheck — obrigatório, não existe em alpine por padrão
RUN apk add --no-cache wget

ENV NODE_ENV=production

WORKDIR /app

# output: 'standalone' em next.config.ts gera bundle auto-suficiente.
# O diretório standalone inclui server.js + deps mínimas de runtime.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Usuário não-root — princípio de menor privilégio
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["node", "server.js"]
