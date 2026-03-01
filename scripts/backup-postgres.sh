#!/usr/bin/env bash
# backup-postgres.sh — Backup diário do PostgreSQL via pg_dump
# Executado pelo cron: 0 3 * * * /opt/zonadev-auth/scripts/backup-postgres.sh
#
# AVISO: Backup armazenado no mesmo VPS que o banco.
# Perda total do VPS = perda de banco + chaves RSA + backups.
# Prioridade Fase 2: envio automático para S3 ou Backblaze B2.
# Ver docs/roadmap-fase2.md seção "Backup Offsite".
#
# AVISO: Este script usa `docker compose exec` para executar o pg_dump.
# Se o container postgres cair, o backup falha silenciosamente sem monitoramento.
# Alternativa mais resiliente (Fase 2): cliente psql local conectando via
# PGHOST diretamente ao container, eliminando dependência do processo docker.
set -euo pipefail

APP_DIR="/opt/zonadev-auth"
BACKUP_DIR="$APP_DIR/backups"
LOG_FILE="/var/log/zonadev-backup.log"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M")
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"
KEEP_DAYS=7  # Manter apenas os 7 backups mais recentes

# Carrega variáveis de ambiente do .env
if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "[$(date -Iseconds)] ERRO: $APP_DIR/.env não encontrado" | tee -a "$LOG_FILE"
  exit 1
fi

# shellcheck disable=SC1091
set -a
source "$APP_DIR/.env"
set +a

DB_USER="${DB_USER:?DB_USER não definido no .env}"
DB_NAME="${DB_NAME:?DB_NAME não definido no .env}"

# ─── Verificar container postgres em execução ─────────────────────────────────
cd "$APP_DIR"

if ! docker compose ps postgres | grep -q "running\|Up"; then
  echo "[$(date -Iseconds)] ERRO: Container postgres não está em execução — backup abortado" | tee -a "$LOG_FILE"
  exit 1
fi

# ─── Criar diretório de backup ───────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ─── Executar pg_dump ────────────────────────────────────────────────────────
echo "[$(date -Iseconds)] Iniciando backup: $BACKUP_FILE" | tee -a "$LOG_FILE"

docker compose exec -T postgres \
  pg_dump -U "$DB_USER" -d "$DB_NAME" --no-password \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup concluído: $BACKUP_FILE ($BACKUP_SIZE)" | tee -a "$LOG_FILE"

# ─── Remover backups antigos (manter apenas os N mais recentes) ───────────────
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" | wc -l)

if [[ $BACKUP_COUNT -gt $KEEP_DAYS ]]; then
  REMOVE_COUNT=$((BACKUP_COUNT - KEEP_DAYS))
  echo "[$(date -Iseconds)] Removendo $REMOVE_COUNT backup(s) antigo(s)..." | tee -a "$LOG_FILE"

  # Ordena por nome (timestamp incluso) — remove os mais antigos
  find "$BACKUP_DIR" -name "backup_*.sql.gz" \
    | sort \
    | head -n "$REMOVE_COUNT" \
    | xargs rm -f

  echo "[$(date -Iseconds)] Limpeza concluída. Backups retidos: $KEEP_DAYS" | tee -a "$LOG_FILE"
fi

echo "[$(date -Iseconds)] Backup finalizado com sucesso." | tee -a "$LOG_FILE"
