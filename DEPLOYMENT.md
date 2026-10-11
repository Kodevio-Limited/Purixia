# Purixia BD — Deployment & Operations

Production topology: Docker Compose on Dokploy, Traefik as the load balancer.

| Service | Image / build | Public address | Replicas |
|---|---|---|---|
| `frontend` | `./frontend` (Next.js) | `https://purixiabd.com`, `https://www.purixiabd.com` | 2 |
| `backend` | `./backend` (Gunicorn `gthread`) | `https://admin.purixiabd.com` (incl. `/admin/`) | 2 |
| `migrate` | same as backend, one-shot | — (runs `migrate` + `ensure_admin` + `collectstatic`, then exits) | 1 run |
| `db` | `postgres:16-alpine` | internal only | 1 |
| `redis` | `redis:7-alpine` | internal only | 1 |

The storefront calls the API **directly** at `https://admin.purixiabd.com`
(same-site subdomains, `SameSite=Lax` refresh cookie, CORS allow-list).
Postgres data lives on the `postgres_data` volume, uploads on `media_data` —
**never delete these volumes** unless you intend to wipe users, orders and uploads.

Related docs: `WORKFLOWS.md` (behaviour), `SCALING.md` (capacity plan),
`backend/.env.example` (local-dev template — production values come from
Dokploy, never from a file).

---

## 1. Prerequisites

1. **DNS** `A` records on `purixiabd.com` pointing to the server IP:
   `@`, `www`, `admin`.
2. **Dokploy** with Traefik running (`websecure` entrypoint, `letsencrypt`
   resolver, external `dokploy-network` — all referenced by the labels in
   `docker-compose.yml`).
3. This repo pushed to git; Dokploy deploys `docker-compose.yml` as a
   **Docker Compose** service.
4. **Secrets below set in Dokploy → Service → Environment.** There is no
   committed `.env`; `backend/.env` exists only for local dev and is git-ignored.

## 2. Environment variables

### Required (boot fails without them)

| Variable | Used by | Notes |
|---|---|---|
| `SECRET_KEY` | backend, migrate | ≥ 32 random chars. `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `POSTGRES_PASSWORD` | db, backend, migrate | Single source of DB credentials (`DB_*` fall back to `POSTGRES_*`) |
| `ALLOWED_HOSTS` | backend, migrate | Explicit list, no `*`. Default: `purixiabd.com,www.purixiabd.com,admin.purixiabd.com` |
| `CORS_ALLOWED_ORIGINS` | backend, migrate | Must contain the storefront origins. Default: `https://purixiabd.com,https://www.purixiabd.com` |
| `REDIS_URL` | backend, migrate | Required so throttles/caches are shared across replicas. Default: `redis://redis:6379/0` |

### Admin bootstrap (first deploy)

| Variable | Notes |
|---|---|
| `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Superuser created by the `migrate` service |
| `ADMIN_RESET_PASSWORD=1` | Set **once** to (re)set the admin password, then remove it or set `0` |

### Email (optional, recommended)

Without these, password-reset and verification mails print to the container
log instead of being delivered (ordering is never blocked either way).

| Variable | Default |
|---|---|
| `EMAIL_HOST` / `EMAIL_PORT` | SMTP host, `587` |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` | SMTP credentials |
| `EMAIL_USE_TLS` / `EMAIL_USE_SSL` | `True` / `False` (TLS *or* SSL, not both) |
| `DEFAULT_FROM_EMAIL` | `Purixia BD <no-reply@purixiabd.com>` |
| `FRONTEND_URL` | `https://purixiabd.com` (builds the links inside mails) |
| `PASSWORD_RESET_TIMEOUT` | `86400` (seconds; links are single-use regardless) |

### Tuning (all have safe defaults — see `backend/.env.example`)

`DELIVERY_CHARGE_INSIDE/OUTSIDE` (60/120), `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` (60),
`JWT_REFRESH_TOKEN_LIFETIME_DAYS` (7), `THROTTLE_ANON/USER/AUTH/ORDER/EMAIL_SEND`,
`MAX_OPEN_ORDERS` (1), `GUNICORN_WORKERS` (4), `GUNICORN_THREADS` (8),
`DB_CONN_MAX_AGE` (120), `REFRESH_COOKIE_*` (name/path/SameSite; `Secure` is
forced on in production — do not override it off).

## 3. Deploying

1. Set the Environment values above in Dokploy.
2. Deploy / redeploy the Compose service. Order is automatic:
   `db` + `redis` (healthy) → `migrate` (schema + admin + static) → `backend`
   → `frontend`.
3. Verify: `https://admin.purixiabd.com/api/health/` → `{"status":"ok"}`,
   storefront loads, test login + checkout.

### Replicas & resources

- Defaults: backend 2 × (4 workers × 8 threads = 32 in-flight each), frontend 2.
  Memory limits: 768M backend / 512M frontend per replica.
- Scale without editing: `docker compose up -d --scale backend=3` (or change
  `deploy.replicas` and redeploy).
- **Connection budget:** Django keeps one persistent DB connection per handling
  **thread**, so the ceiling is `replicas × workers × threads` — the compose
  default is 2 × 4 × 8 = **64**. Keep that under ~80% of Postgres
  `max_connections` (default 100): a 3rd replica reaches ~96, which is why
  **PgBouncer (transaction pooling) is required before scaling past 2 backends**
  (set `DB_CONN_MAX_AGE=0` in the app when PgBouncer owns pooling). Each worker
  also holds ~50 MB RSS.
- **Rolling restarts are non-dropping only if you DRAIN first.** Traefik keeps
  routing to a replica for one healthcheck interval after it stops accepting, so
  a bare restart loses requests. Take the replica out of rotation, wait two
  healthcheck intervals, restart, wait for healthy, put it back (see §5.1).
- Traefik only routes to replicas answering `/api/health/` (readiness: DB +
  Redis probed, 503 on failure).
- Liveness (`/api/health/live/`) is dependency-free — a brief DB/Redis blip
  never restarts a healthy container.
- **Worker recycling:** Gunicorn recycles a worker every `GUNICORN_MAX_REQUESTS`
  (default 5000). Recycling briefly closes connections the LB may still hold;
  this is the residual source of rare 502s under sustained load and the reason
  for drain-first restarts. Raising the value trades leak containment for fewer
  502s; `0` disables recycling.

### 5.1 Drain-first rolling restart

Never `docker restart` a replica that is in Traefik's rotation. On Dokploy,
scale the service down/up one replica at a time (or, with the file/label
provider, disable the router for that replica), allowing
`stop_grace_period` (40s) to finish in-flight requests before the new container
joins. Verified in the Phase 6 simulation: **0 failed requests** across two
backend and one frontend replica restarted this way.

## 4. Migrations & rollback

- Schema changes run **once** in the `migrate` service before replicas start;
  replicas have `MIGRATE_ON_BOOT=0` so scaling out never races a migration.
- Policy: migrations must be **additive-only** (add column/table/index — never
  drop, rename, or backfill destructively) without explicit approval.
- **Rollback = redeploy the previous commit.** Because migrations are additive,
  old code runs fine on the newer schema (extra columns are ignored). If a
  migration ever does need reverting, restore from backup (below) instead of
  hand-editing the schema.
- After deploying a migration, confirm: `migrate` service shows
  `service_completed_successfully` and `/api/health/` is 200 on all replicas.

## 5. Backups

`scripts/backup-postgres.sh` takes a compressed custom-format dump and keeps
the newest `$BACKUP_KEEP` (default 7). Backup + restore + retention were
verified against `postgres:16-alpine` (dump → drop table → `pg_restore` →
row back).

### Schedule (Dokploy cron, daily 03:00 Asia/Dhaka)

Dokploy → Cron Jobs, command (replace `<net>` with the compose network from
`docker network ls`, e.g. `purixia_backend-net`):

```sh
docker run --rm --network <net> \
  -v /opt/purixia/scripts:/scripts:ro \
  -v /var/backups/purixia:/backups \
  -e POSTGRES_DB=purixia -e POSTGRES_USER=purixia \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_HOST=db -e BACKUP_DIR=/backups -e BACKUP_KEEP=7 \
  postgres:16-alpine sh /scripts/backup-postgres.sh
```

Host-cron equivalent works identically. Dumps land in `/var/backups/purixia`
— **copy them off the server** (the schedule is worthless if the disk dies
with the backups). Off-site sync (rsync/rclone to S3-compatible storage) is
the next step when media moves off the volume too.

### Restore (maintenance procedure)

```sh
# 1. Stop traffic: in Dokploy, stop the app (or scale backend to 0).
# 2. Restore over the existing database (replace FILE):
docker run --rm --network <net> -v /var/backups/purixia:/backups:ro \
  -e PGPASSWORD="$POSTGRES_PASSWORD" postgres:16-alpine \
  pg_restore -h db -U purixia -d purixia --clean --if-exists \
    /backups/FILE.dump
# 3. Start the app, then verify: /api/health/ is 200 and spot-check an order
#    and a login in the admin panel.
```

`--clean --if-exists` drops each object before recreating it; the database
itself must exist (it does — restore targets the live `purixia` DB). Practice
this on a staging copy at least once before you need it for real.

## 6. Secret rotation

`backend/.env`, `db.sqlite3` files were once committed to git history and have
since been removed — but **history is forever**. Treat every credential that
ever lived in them as public:

- [ ] `SECRET_KEY` — set a fresh value in Dokploy, redeploy. All JWTs
      (access + refresh) and emailed reset/verification links invalidate at
      once; every customer is logged out and must sign in again. Announce it.
- [ ] `POSTGRES_PASSWORD` (and `DB_PASSWORD` if it differs) — change in
      Dokploy, redeploy. Brief downtime while backend reconnects.
- [ ] Admin password — set `ADMIN_RESET_PASSWORD=1` for one deploy, then remove it.
- [ ] SMTP credentials (`EMAIL_HOST_PASSWORD`) — rotate at the provider, update Dokploy.
- [ ] Never commit `.env` or `*.sqlite3` again (both are git-ignored); never
      print secret values into logs, chat, or tickets.

## 7. Media files (single-server limit — decision needed)

Uploads live on the `media_data` **named volume**: it survives redeploys but
exists on one host only. Today that is fine (one Dokploy server). It becomes
the scaling ceiling the day a second host appears: a backend replica on host B
cannot see host A's volume, so product images would 404 depending on which
replica Traefik picks.

Options (not implemented — awaiting decision):

| Option | Effort | Notes |
|---|---|---|
| **A. S3-compatible object storage** (e.g. Sudospaces/Wasabi/MinIO) via `django-storages` | medium | True multi-host; CDN-ready; new dependency + bucket credentials |
| **B. Shared filesystem** (NFS/Longhorn) mounted as the media volume | low-medium | Keeps Django storage as-is; still a single failure domain unless replicated |

Recommendation: A when the second host is planned; until then B is unnecessary
— the volume plus DB backups is enough. Media is **not** covered by the
Postgres backup; include `/var/lib/docker/volumes/.../media_data` (or the
S3 bucket, once moved) in the off-site copy.

## 8. Observability

- **Logs:** backend emits **JSON lines to stdout** (`level`, `logger`, `msg`,
  `ts`, `request_id`; tracebacks in `exc`). View with `docker compose logs`
  or Dokploy's log viewer. Nothing is written to files — the repo's `logs/`
  folder is unused (proposed for removal, see Phase 5 report).
- **Request IDs:** every response carries `X-Request-ID` (incoming value
  echoed, else generated). Quote it in bug reports; `grep` it in logs to
  follow one checkout across replicas.
- **Health:** `/api/health/` (readiness, Traefik + Docker) and
  `/api/health/live/` (liveness). Frontend: `/api/health`.
- **Sentry:** wired on both ends, **off unless a DSN is set**. Backend:
  `sentry-sdk` initialised from `core/wsgi.py` when `SENTRY_DSN` is set
  (missing package degrades to a warning, never a crash). Frontend:
  `@sentry/nextjs` initialised in root `Providers` when
  `NEXT_PUBLIC_SENTRY_DSN` is set (rebuild required — it is inlined at build
  time). Both send errors always, traces sampled (`*_TRACES_SAMPLE_RATE`,
  default 0.1), PII sending off. Deliberately minimal: no `withSentryConfig`
  wrapper, so **Next.js server-side crashes are not captured yet** — browser
  errors are. Add server instrumentation when SSR errors matter.
- **Alerts worth adding:** Traefik health-check flaps, `5xx` rate on
  `/api/orders/place/`, backup-job failure, disk usage on the DB/media host.
