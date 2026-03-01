# Deploy — ZonaDev Auth

## Pré-requisitos

- VPS Ubuntu 22.04 LTS (mínimo 2GB RAM, 20GB disco)
- Domínio apontando para o IP do VPS (ex: `auth.seudominio.com`)
- Acesso SSH como root
- Conta GitHub com secrets configurados

---

## 1. Configurar SSH para GitHub Actions

No VPS, gere um par de chaves SSH dedicado para o CI/CD:

```bash
ssh-keygen -t ed25519 -C "github-actions-zonadev" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

No repositório GitHub → **Settings → Secrets and variables → Actions**, crie:

| Secret | Valor |
|--------|-------|
| `VPS_HOST` | IP ou hostname do VPS |
| `VPS_USER` | Usuário SSH (ex: `root`) |
| `VPS_SSH_KEY` | Conteúdo de `~/.ssh/github_actions` (chave **privada**) |

---

## 2. Executar setup inicial no VPS

```bash
# Clone temporário para obter o script
git clone https://github.com/seu-usuario/zonadev-auth.git /tmp/zonadev-setup
chmod +x /tmp/zonadev-setup/scripts/setup-vps.sh

# Executar com variável de ambiente para evitar prompt interativo
REPO_URL=https://github.com/seu-usuario/zonadev-auth.git \
  sudo /tmp/zonadev-setup/scripts/setup-vps.sh
```

O script irá:
1. Instalar Docker, Fail2ban, UFW
2. Clonar o repositório em `/opt/zonadev-auth`
3. Guiar a criação do `.env`
4. Gerar chaves RSA em `keys/`
5. Configurar crons de backup e alerta de disco
6. Executar migrations e subir os containers

---

## 3. Configurar HTTPS com Certbot

```bash
apt install certbot -y

# Parar nginx temporariamente (liberando porta 80)
docker compose -f /opt/zonadev-auth/docker-compose.yml stop nginx

# Obter certificado
certbot certonly --standalone -d auth.seudominio.com

# Copiar certificados para o diretório do nginx
mkdir -p /opt/zonadev-auth/nginx/certs
cp /etc/letsencrypt/live/auth.seudominio.com/fullchain.pem /opt/zonadev-auth/nginx/certs/
cp /etc/letsencrypt/live/auth.seudominio.com/privkey.pem   /opt/zonadev-auth/nginx/certs/

# Subir nginx com TLS
docker compose -f /opt/zonadev-auth/docker-compose.yml up -d nginx
```

**Renovação automática:**

```bash
# Adicionar ao crontab (renova quando < 30 dias para expirar)
0 2 * * * certbot renew --quiet --deploy-hook \
  "cp /etc/letsencrypt/live/auth.seudominio.com/*.pem /opt/zonadev-auth/nginx/certs/ \
   && docker compose -f /opt/zonadev-auth/docker-compose.yml restart nginx"
```

**Alternativa (Fase 2):** Traefik containerizado com ACME elimina o acoplamento com o host. Ver `docs/roadmap-fase2.md`.

---

## 4. Migration manual em produção

Para rodar migrations sem passar pelo CI/CD:

```bash
cd /opt/zonadev-auth
docker compose run --rm migrate
```

Para reverter a última migration:

```bash
# Criar script temporário de revert — migration:revert usa ts-node também
docker compose run --rm migrate pnpm run migration:revert
```

---

## 5. Comandos de monitoramento

```bash
cd /opt/zonadev-auth

# Status de todos os serviços
docker compose ps

# Logs em tempo real (todos os serviços)
docker compose logs -f

# Logs de um serviço específico
docker compose logs -f backend
docker compose logs -f nginx

# Uso de recursos (CPU, memória)
docker stats

# Verificar healthcheck
curl -s https://auth.seudominio.com/health | jq
```

---

## 6. Restauração de backup

```bash
cd /opt/zonadev-auth

# Listar backups disponíveis
ls -lh backups/

# Restaurar backup específico
BACKUP_FILE="backups/backup_2026-03-01_03-00.sql.gz"

# Descompactar e restaurar
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres \
  psql -U "$DB_USER" -d "$DB_NAME"
```

---

## 7. Configurar UptimeRobot

1. Criar conta em https://uptimerobot.com (gratuito até 50 monitores)
2. Adicionar monitor HTTP(s):
   - **URL:** `https://auth.seudominio.com/health`
   - **Interval:** 5 minutos
   - **Alert contact:** e-mail ou webhook

---

## 8. Diagrama de Arquitetura

```
Internet
   ↓ 80/443 (HTTP/HTTPS)
Nginx [rede: public]
   │                    │
   ↓                    ↓
Frontend (Next.js)   /auth/* (rate limit: Nginx + NestJS Throttler)
[rede: internal]     /.well-known/*
                     /health
                          ↓
                    Backend (NestJS) [rede: internal]
                          │
                    ┌─────┴──────┐
                    ↓            ↓
              PostgreSQL       Redis
              (volume          (blacklist JWT
               persistente)     + rate limit)
              [rede: internal] [rede: internal]
```

**Redes Docker:**
- `internal` (bridge, `internal: true`): postgres, redis, backend. Sem saída para internet.
- `public` (bridge): frontend, nginx. Com saída para internet (necessário para Certbot e SMTP).

---

## 9. GitHub Actions Secrets necessários

| Secret | Descrição |
|--------|-----------|
| `VPS_HOST` | IP do servidor |
| `VPS_USER` | Usuário SSH |
| `VPS_SSH_KEY` | Chave privada SSH (Ed25519) |

O workflow `.github/workflows/deploy.yml` executa o deploy a cada push na branch `main`.
