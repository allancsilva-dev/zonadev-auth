#!/usr/bin/env bash
# disk-alert.sh — Alerta de uso de disco
# Executado pelo cron a cada 30 minutos:
#   */30 * * * * /opt/zonadev-auth/scripts/disk-alert.sh
#
# Envia webhook (Slack/Discord/HTTP) se uso de '/' >= DISK_THRESHOLD%.
# Se ALERT_WEBHOOK_URL não configurado, loga em /var/log/zonadev-disk.log.
#
# Nota: Prometheus + Alertmanager é a solução robusta de observabilidade.
# Este script é um placeholder até a implementação de monitoring completo.
# Ver docs/roadmap-fase2.md seção "Monitoring interno".
set -euo pipefail

APP_DIR="/opt/zonadev-auth"
LOG_FILE="/var/log/zonadev-disk.log"
DISK_THRESHOLD=85

# Carrega variáveis de ambiente do .env (para ALERT_WEBHOOK_URL)
if [[ -f "$APP_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  source "$APP_DIR/.env"
  set +a
fi

ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
HOSTNAME_VAL=$(hostname)

# ─── Verificar uso de disco de '/' ───────────────────────────────────────────
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')

if [[ $DISK_USAGE -lt $DISK_THRESHOLD ]]; then
  # Uso normal — sem alerta
  exit 0
fi

# ─── Uso acima do threshold — enviar alerta ───────────────────────────────────
DISK_DETAIL=$(df -h / | awk 'NR==2 {print "Total: "$2" | Usado: "$3" | Livre: "$4}')
MESSAGE="🚨 *ZonaDev Auth — Alerta de Disco*\nHost: \`${HOSTNAME_VAL}\`\nUso de /: *${DISK_USAGE}%* (limite: ${DISK_THRESHOLD}%)\n${DISK_DETAIL}"

TIMESTAMP=$(date -Iseconds)

if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
  # Envia para webhook (Slack/Discord — formato compatível com ambos)
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "$ALERT_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"${MESSAGE}\"}" \
    --max-time 10)

  if [[ "$HTTP_STATUS" == "200" || "$HTTP_STATUS" == "204" ]]; then
    echo "[$TIMESTAMP] ALERTA enviado (HTTP $HTTP_STATUS): Disco ${DISK_USAGE}%" >> "$LOG_FILE"
  else
    echo "[$TIMESTAMP] ERRO ao enviar alerta (HTTP $HTTP_STATUS): Disco ${DISK_USAGE}%" >> "$LOG_FILE"
  fi
else
  # Fallback: apenas log local quando webhook não configurado
  echo "[$TIMESTAMP] ALERTA (sem webhook): Disco ${DISK_USAGE}% >= ${DISK_THRESHOLD}% — ${DISK_DETAIL}" | tee -a "$LOG_FILE"
fi
