# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# pnpm instalado via npm — backend usa pnpm localmente
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS production

# wget não existe em node:alpine por padrão.
# Instalação explícita obrigatória — sem isso o HEALTHCHECK quebra silenciosamente.
RUN apk add --no-cache wget

# pnpm necessário para instalar apenas deps de produção
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder /app/dist ./dist

# Usuário não-root — princípio de menor privilégio
USER node

EXPOSE 3001

# Healthcheck real — depende do wget instalado acima
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/main.js"]

# NOTA: ./keys/ NUNCA é copiado nesta imagem.
# Montado como volume read-only em runtime via docker-compose:
#   volumes:
#     - ./keys:/app/keys:ro
