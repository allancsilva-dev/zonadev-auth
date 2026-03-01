# Roadmap — Fase 2

Backlog priorizado para após o deploy estável em produção.
Itens em ordem de prioridade operacional e risco.

---

## 1. Backup Offsite ← Prioridade máxima

**Por que:** Backup armazenado no mesmo VPS que o banco. Falha catastrófica do servidor
implica perda simultânea de dados e backups.

**Implementação:**
- Adicionar envio automático para S3 ou Backblaze B2 ao final do `backup-postgres.sh`
- Usar `aws s3 cp` ou `b2 upload-file` com credenciais limitadas (write-only bucket)
- Reter últimos 30 dias em cloud, 7 locais

```bash
# Exemplo S3 — adicionar ao backup-postgres.sh após gzip:
aws s3 cp "$BACKUP_FILE" "s3://zonadev-backups/$(basename $BACKUP_FILE)" \
  --storage-class STANDARD_IA
```

---

## 2. Auditoria persistida + indexação

**Por que:** Auditoria atual salva no PostgreSQL. Em volumes altos ou incidentes de segurança,
consultar logs em SQL é lento e não permite alertas em tempo real.

**Implementação:**
- Exportar logs de auditoria do stdout Docker via Promtail → Loki
- Grafana dashboards para:
  - Taxa de login failures por IP (anomalia de brute force)
  - Token reuse detection
  - Sessões simultâneas por usuário
- Alertas no Alertmanager para eventos críticos (`TOKEN_REUSE_DETECTED`, `LICENSE_EXPIRED`)

---

## 3. Monitoring interno — Prometheus + Grafana + Loki + Alertmanager

**Por que:** O `disk-alert.sh` e o UptimeRobot são placeholders. Um IdP em produção
precisa de observabilidade completa.

**Stack:**
```yaml
# Adicionar ao docker-compose.yml (rede: monitoring)
prometheus:
  image: prom/prometheus
grafana:
  image: grafana/grafana
loki:
  image: grafana/loki
alertmanager:
  image: prom/alertmanager
promtail:
  image: grafana/promtail
```

**Métricas a expor no backend:**
- `auth_login_total{status="success|failure"}`
- `auth_refresh_total{status="success|failure"}`
- `http_request_duration_seconds` (latência por endpoint)
- `db_pool_connections_active`

---

## 4. JWKS multi-key + Key Rotation

**Por que:** Chave RSA única sem rotação. Vazamento exige revogação manual e downtime.

**Implementação:**
- Suportar múltiplos pares RSA simultâneos (indexados por `kid`)
- JWKS endpoint expõe todas as chaves ativas
- Rotação automática programada (cron semanal/mensal):
  1. Gera novo par
  2. Emite novos tokens com novo `kid`
  3. Mantém chave antiga ativa por `JWT_ACCESS_EXPIRES` para validar tokens existentes
  4. Remove chave antiga após expiração

---

## 5. Refresh Token com Fingerprint de Sessão

**Por que:** Token não está atrelado ao dispositivo. Roubo de cookie permite uso de qualquer IP.

**Implementação:**
- Armazenar `device_fingerprint = hash(user_agent + ip_subnet)` no refresh_tokens
- No refresh: comparar fingerprint atual com armazenado
- Divergência gera evento de auditoria `SESSION_ANOMALY`
- Política configurável: bloquear, alertar ou apenas registrar

**Cuidado com falsos positivos:**
- VPN (IP muda)
- Mobile com IP dinâmico (4G/5G)
- Usar apenas os primeiros 2 octetos do IP como subnet

---

## 6. CORS Dinâmico por Tenant

**Por que:** Lista de origens CORS definida em `.env` (estática). Novos clientes exigem
redeploy ou restart do backend.

**Implementação:**
- Tabela `applications` no banco com `origin`, `tenant_id`, `active`
- Substituir `ALLOWED_AUDIENCES` env por consulta ao banco em cache (TTL 5min)
- Cache via Redis ou Map em memória
- Admin panel para gerenciar origins sem deploy

---

## 7. Blue/Green Deploy — Zero Downtime Absoluto

**Por que:** `docker compose up -d --remove-orphans` causa ~2-5s de downtime durante
rebuild do container backend.

**Implementação:**
- Nginx upstream com dois backends (blue + green)
- Deploy para o backend inativo, testar healthcheck
- Fazer swapover no nginx atomicamente
- Alternativa mais simples: Docker Swarm rolling update

---

## 8. Secrets Manager

**Por que:** `.env` no VPS com todas as credenciais em texto plano.
Qualquer processo com acesso ao filesystem lê todos os secrets.

**Opções (por complexidade crescente):**
- **Docker Secrets** (Swarm mode): secrets em memória, não no disco
- **HashiCorp Vault**: secrets dinâmicos, rotação automática, auditoria
- **AWS Secrets Manager / GCP Secret Manager**: managed, pago

---

## 9. Certbot Containerizado (Traefik ACME)

**Por que:** Certbot no host cria acoplamento fora do Docker. Renovação exige restart do nginx.

**Implementação:**
```yaml
traefik:
  image: traefik:v3
  command:
    - --certificatesresolvers.letsencrypt.acme.tlschallenge=true
    - --certificatesresolvers.letsencrypt.acme.email=admin@seudominio.com
    - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
  volumes:
    - ./letsencrypt:/letsencrypt
  ports:
    - "80:80"
    - "443:443"
```

Renovação automática sem intervenção manual ou cron externo.

---

## 10. pg_dump resiliente sem dependência do container

**Por que:** `backup-postgres.sh` usa `docker compose exec postgres pg_dump`.
Se o container estiver parado ou travado, o backup falha.

**Implementação:**
- Instalar `postgresql-client` no host VPS
- Conectar diretamente ao container via porta publicada (apenas localhost)
- Ou usar container auxiliar temporário para o pg_dump

```bash
# Alternativa resiliente:
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h 127.0.0.1 -p 5432 \
  -U "$DB_USER" -d "$DB_NAME" \
  | gzip > "$BACKUP_FILE"
```

Isso funciona mesmo se o processo `docker compose exec` travar.
