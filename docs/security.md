# Segurança — ZonaDev Auth

## Decisões Arquiteturais e seus Trade-offs

| Decisão | Comportamento | Trade-off |
|---|---|---|
| Redis sem persistência (`--save ""`) | Restart invalida todas as refresh sessions | Fail-secure: usuários fazem login novamente. Se inaceitável para o SLA, habilitar AOF e documentar impacto em disco. |
| Certbot no host | Renovação fora do Docker | Mais simples de operar. Acoplamento fora do container. Fase 2: Traefik com ACME. |
| Backup local (mesmo VPS) | Zero configuração extra | Perda total se VPS morrer. Fase 2: envio offsite obrigatório. |
| Rate limit Nginx + ThrottlerGuard | Defense-in-depth | Dois pontos de controle independentes. Se container interno for comprometido, o backend ainda tem rate limit. |
| Refresh tokens em PostgreSQL (SHA-256) | Stateful no banco relacional | Mais durável que Redis. Exige query no banco a cada refresh. Fase 2: avaliar cache Redis como índice. |

---

## Atualizando a CSP

A Content-Security-Policy está configurada em `nginx/nginx.conf`. Qualquer dependência externa adicionada ao frontend quebra silenciosamente sem atualização da CSP.

**Como testar:** Abra o DevTools do browser → aba Console → filtre por erros de CSP após qualquer alteração.

### Tabela de exceções comuns

| Serviço | Diretiva a atualizar |
|---|---|
| Google Fonts | `font-src fonts.gstatic.com; style-src ... fonts.googleapis.com` |
| Google Analytics (GA4) | `script-src ... www.googletagmanager.com; connect-src ... www.google-analytics.com` |
| reCAPTCHA v3 | `script-src ... www.google.com; frame-src ... www.google.com` |
| Cloudflare CDN (jsDelivr) | `script-src ... cdnjs.cloudflare.com cdn.jsdelivr.net` |
| OAuth externo (Google, GitHub) | `connect-src ... accounts.google.com github.com` |
| Stripe | `script-src ... js.stripe.com; frame-src ... js.stripe.com; connect-src ... api.stripe.com` |

**Procedimento:**

1. Identificar o erro de CSP no Console (ex: `Refused to load script from 'https://...'`)
2. Identificar a diretiva violada
3. Adicionar o domínio mínimo necessário na diretiva correta em `nginx/nginx.conf`
4. Testar em staging antes de produção
5. Nunca usar `unsafe-eval` sem justificativa documentada

---

## Rate Limit atrás de CDN

### Problema

O `nginx.conf` usa `$binary_remote_addr` (IP direto do TCP) para rate limiting. Se o servidor estiver atrás de Cloudflare ou outro CDN/proxy reverso, todos os requests virão do IP do CDN — o rate limit seria aplicado ao CDN, não ao usuário real.

### Solução por CDN

**Cloudflare:**
```nginx
# No bloco http do nginx.conf, antes dos blocos server:
real_ip_header    CF-Connecting-IP;
set_real_ip_from  103.21.244.0/22;   # Ranges de IP Cloudflare
set_real_ip_from  103.22.200.0/22;   # (adicionar todos da lista oficial)
# ...demais ranges em: https://www.cloudflare.com/ips/

# Trocar $binary_remote_addr por $realip_remote_addr nas zonas:
limit_req_zone $realip_remote_addr zone=api_limit:10m  rate=10r/s;
limit_req_zone $realip_remote_addr zone=auth_limit:10m rate=3r/s;
```

**Proxy genérico com X-Forwarded-For confiável:**
```nginx
real_ip_header    X-Forwarded-For;
set_real_ip_from  10.0.0.0/8;  # IP do seu load balancer
real_ip_recursive on;
```

**Atenção:** Nunca confiar em `X-Forwarded-For` de origem desconhecida — qualquer cliente pode forjar esse header.

---

## Refresh Token — Limitação atual

### Implementação atual

O refresh token usa SHA-256 do token raw armazenado no PostgreSQL. Validação via `tokenHash` — token revogado explicitamente via `revokedAt`. Token rotation obrigatória (single-use). Reuse detection com invalidação de todas as sessões do usuário.

### Limitação conhecida

O token **não está atrelado a fingerprint de sessão** (User-Agent, IP, device_id). Um refresh token roubado pode ser usado de qualquer origem.

### Risco

Baixo em cenário normal (token em cookie HTTP-only, difícil de extrair sem XSS). Médio se houver vazamento de cookie via XSS ou ataque de rede.

### Plano Fase 2

Implementar fingerprint de sessão:
- Armazenar hash de `User-Agent + IP subnet` no momento de emissão
- Validar no refresh — divergência gera alerta e pode revogar sessão
- Documentar falsos positivos (VPN, mobile IP dinâmico)

---

## Chaves RSA — Maior risco estrutural

### Situação atual

- Chave privada em `keys/private.pem` no VPS
- Montada como volume read-only no container backend
- Nunca copiada na imagem Docker
- Sem rotação automática

### Impacto de vazamento

Se `private.pem` vazar, um atacante pode forjar JWTs válidos para qualquer usuário. Mitigação requer:
1. Revogar a chave imediatamente (nova `kid`)
2. Gerar novo par RSA
3. Reiniciar backend com nova chave
4. Todos os access tokens anteriores se tornam inválidos na próxima validação JWKS

### Plano Fase 2 — JWKS multi-key + rotação

Suportar múltiplas chaves ativas simultaneamente:
- Emitir tokens com a chave mais recente (`kid` no header)
- JWKS expõe todas as chaves ativas (máximo N chaves)
- Rotação programada: nova chave, manter antiga por `expiresIn` do access token
- Usar Docker secrets ou HashiCorp Vault para armazenar as chaves

---

## Auditoria

### Implementação atual

Auditoria persistida no PostgreSQL via `AuditLog` entity. Eventos registrados:
- `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_BLOCKED_EMAIL_NOT_VERIFIED`
- `LOGOUT`, `TOKEN_REFRESHED`, `TOKEN_REUSE_DETECTED`
- `LICENSE_EXPIRED`, `PASSWORD_RESET`

**Nota de divergência:** A auditoria usa PostgreSQL diretamente (mais robusto que stdout-only). Logs estruturados em JSON para stdout podem ser adicionados como complemento na Fase 2.

### Consultas úteis

```sql
-- Login failures nas últimas 24h por IP
SELECT ip_address, COUNT(*) as attempts
FROM audit_logs
WHERE action = 'LOGIN_FAILED'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY ip_address
ORDER BY attempts DESC
LIMIT 20;

-- Reutilização de token detectada
SELECT * FROM audit_logs
WHERE action = 'TOKEN_REUSE_DETECTED'
ORDER BY created_at DESC
LIMIT 10;
```

### Fase 2 — Indexação

Para volumes altos, indexar logs em Loki (Grafana stack) ou CloudWatch:
- Exportar logs do stdout Docker via Promtail → Loki
- Dashboards Grafana para anomalias de autenticação
