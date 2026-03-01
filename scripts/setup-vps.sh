#!/usr/bin/env bash
# setup-vps.sh — Configuração inicial do VPS para ZonaDev Auth
# Executar UMA VEZ como root em servidor virgem Ubuntu 22.04 LTS.
#
# Uso:
#   chmod +x scripts/setup-vps.sh
#   sudo ./scripts/setup-vps.sh
set -euo pipefail

# ─── Cores para output ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[aviso]${NC} $*"; }
err()  { echo -e "${RED}[erro]${NC} $*" >&2; }

APP_DIR="/opt/zonadev-auth"
REPO_URL="${REPO_URL:-}"

# ─── 1. Verificar root ───────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "Este script deve ser executado como root: sudo ./scripts/setup-vps.sh"
  exit 1
fi

log "Iniciando setup do VPS ZonaDev Auth..."

# ─── 2. Atualizar sistema ────────────────────────────────────────────────────
log "Atualizando pacotes do sistema..."
apt update -y
DEBIAN_FRONTEND=noninteractive apt upgrade -y

# ─── 3. Instalar Docker ──────────────────────────────────────────────────────
if command -v docker &>/dev/null; then
  warn "Docker já instalado: $(docker --version)"
else
  log "Instalando Docker via get.docker.com..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  log "Docker instalado: $(docker --version)"
fi

# ─── 4. Instalar Fail2ban ────────────────────────────────────────────────────
log "Instalando e habilitando Fail2ban..."
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# ─── 5. Instalar unattended-upgrades ─────────────────────────────────────────
log "Configurando atualizações automáticas de segurança..."
apt install -y unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

# ─── 6. Configurar UFW ───────────────────────────────────────────────────────
log "Configurando firewall UFW..."
apt install -y ufw
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable
log "UFW configurado. Status:"
ufw status verbose

# ─── 7. Clonar repositório ───────────────────────────────────────────────────
if [[ -z "$REPO_URL" ]]; then
  read -rp "URL do repositório Git (ex: git@github.com:usuario/zonadev-auth.git): " REPO_URL
fi

if [[ -d "$APP_DIR/.git" ]]; then
  warn "Repositório já existe em $APP_DIR — pulando clone."
else
  log "Clonando repositório em $APP_DIR..."
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

# ─── 8. Criar .env a partir de .env.example ──────────────────────────────────
if [[ -f ".env" ]]; then
  warn ".env já existe — não será sobrescrito."
else
  if [[ ! -f ".env.example" ]]; then
    err ".env.example não encontrado em $APP_DIR"
    exit 1
  fi
  log "Criando .env a partir de .env.example..."
  cp .env.example .env
  echo ""
  warn "IMPORTANTE: Edite $APP_DIR/.env com suas configurações reais antes de continuar!"
  warn "Pressione Enter quando o .env estiver configurado..."
  read -r
fi

# ─── 9. Gerar chaves RSA se não existirem ────────────────────────────────────
mkdir -p keys
if [[ -f "keys/private.pem" && -f "keys/public.pem" ]]; then
  warn "Chaves RSA já existem — não serão regeneradas."
else
  log "Gerando par de chaves RSA 2048-bit..."
  openssl genrsa -out keys/private.pem 2048
  openssl rsa -in keys/private.pem -pubout -out keys/public.pem

  # Permissões restritivas — chave privada legível apenas pelo dono
  chmod 600 keys/private.pem
  chmod 644 keys/public.pem
  log "Chaves RSA geradas em $APP_DIR/keys/"

  warn "CRÍTICO: Faça backup das chaves RSA em local seguro fora deste servidor."
  warn "Perda da chave privada invalida TODOS os tokens JWT emitidos."
fi

# ─── 10. Configurar cron de backup ───────────────────────────────────────────
BACKUP_SCRIPT="$APP_DIR/scripts/backup-postgres.sh"
BACKUP_CRON="0 3 * * * $BACKUP_SCRIPT >> /var/log/zonadev-backup.log 2>&1"

chmod +x "$BACKUP_SCRIPT"
chmod +x "$APP_DIR/scripts/disk-alert.sh"

if crontab -l 2>/dev/null | grep -qF "$BACKUP_SCRIPT"; then
  warn "Cron de backup já configurado — pulando."
else
  log "Configurando cron de backup diário às 3h..."
  (crontab -l 2>/dev/null; echo "$BACKUP_CRON") | crontab -
fi

# ─── 11. Configurar cron de alerta de disco ──────────────────────────────────
DISK_SCRIPT="$APP_DIR/scripts/disk-alert.sh"
DISK_CRON="*/30 * * * * $DISK_SCRIPT"

if crontab -l 2>/dev/null | grep -qF "$DISK_SCRIPT"; then
  warn "Cron de alerta de disco já configurado — pulando."
else
  log "Configurando cron de alerta de disco a cada 30 minutos..."
  (crontab -l 2>/dev/null; echo "$DISK_CRON") | crontab -
fi

log "Crontab configurado:"
crontab -l

# ─── 12. Criar diretório de backups ──────────────────────────────────────────
mkdir -p "$APP_DIR/backups"

# ─── 13. Primeiro deploy ─────────────────────────────────────────────────────
log "Iniciando primeiro deploy..."

log "Executando migrations..."
docker compose run --rm migrate

log "Subindo serviços..."
docker compose up -d

log "Status dos containers:"
docker compose ps

# ─── 14. Próximos passos ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Setup concluído! Próximos passos obrigatórios:${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "  1. Configurar HTTPS com Certbot:"
echo "     apt install certbot"
echo "     certbot certonly --webroot -w /var/www/certbot -d auth.seudominio.com"
echo "     # Copiar certs para ./nginx/certs/"
echo "     # Reiniciar nginx: docker compose restart nginx"
echo "     # Configurar renovação automática: ver docs/deploy.md"
echo ""
echo "  2. Adicionar seed de dados iniciais (SUPERADMIN):"
echo "     docker compose exec backend node dist/database/seeds/seed.js"
echo "     # Ou via pnpm se usando container builder:"
echo "     # docker compose run --rm -e NODE_ENV=development backend pnpm run seed"
echo ""
echo "  3. Configurar UptimeRobot para monitorar:"
echo "     https://auth.seudominio.com/health"
echo ""
echo "  4. Fazer backup offsite das chaves RSA (CRÍTICO):"
echo "     $APP_DIR/keys/private.pem"
echo "     $APP_DIR/keys/public.pem"
echo ""
echo "  5. Ler docs/deploy.md e docs/security.md"
echo ""
