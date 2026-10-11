# Purixia BD — Scaling Plan for 200–250 Concurrent Users

This is the plan for taking the storefront from "one box that works" to
"handles 250 people shopping at the same time, with headroom".

Everything described in **Stage 1** and **Stage 2** is already implemented in
this repository. Stages 3–5 are the next steps as traffic and/or uptime
requirements grow.

---

## 1. First, define the target

"250 concurrent users" is **250 people browsing at the same moment**, not 250
requests in flight. A shopper spends most of their time reading a page; actual
in-flight requests are a fraction of that.

| Metric | Realistic peak value |
|---|---|
| Concurrent users (browsing) | 250 |
| Simultaneous in-flight API requests | 25–50 (10–20% of users) |
| Requests/second at peak | ~40–120 req/s |
| Heavy spikes (campaign, flash sale) | 3–5× the above for a few minutes |

**Design target: sustain ~150 req/s with p95 latency under 500 ms, and absorb a
3× burst without errors.**

### Reference measurement (this repo, current code)

Measured on a development machine, single backend replica (9 gthread workers ×
4 threads), PostgreSQL 16, 400 requests at concurrency 50:

```
requests=400 concurrency=50 wall=0.80s throughput=498 req/s
status codes: {200: 400}
latency ms  p50=60  p95=307  max=594
```

A single replica already covers the design target on that box. The plan below is
about keeping it that way as reality (slower disks, noisier neighbours, larger
catalogues, real internet latency) bites — and about surviving a
campaign day and a server failure.

---

## 2. Stage 1 — Single-server hardening ✅ implemented

| Item | Setting |
|---|---|
| Worker model | Gunicorn `gthread`, `workers = 2×CPU+1`, `threads = 4` (`backend/gunicorn.conf.py`) |
| Worker recycling | `max_requests = 5000` ± 100 jitter (raised from 1000 after load testing linked recycling to intermittent 502s; see DEPLOYMENT.md) |
| Timeouts | `timeout 60s`, `graceful_timeout 30s`, `keepalive 5s` |
| DB connections | `CONN_MAX_AGE = 120s` with `CONN_HEALTH_CHECKS` |
| Rate limiting | `anon` 240/min, `user` 4000/hour, `auth` 20/min |
| Static files | WhiteNoise, gzip-precompressed, 30-day cache headers |
| Health probe | `GET /api/health/` (checks the DB) — used by Traefik and Docker |

Tune per replica with environment variables (no rebuild):

```bash
GUNICORN_WORKERS=5      # 5 workers × 4 threads = 20 in-flight requests per replica
GUNICORN_THREADS=4
GUNICORN_MAX_REQUESTS=5000
DB_CONN_MAX_AGE=120     # keep (replicas × workers × THREADS) well under Postgres max_connections
```

**Connection budget (important):** Django keeps one persistent connection per
handling **thread**, not per worker. So the ceiling is
`replicas × workers × threads`, e.g. the compose default 2 × 4 × 8 = **64**.
Keep that under ~80% of Postgres `max_connections` (default 100); add PgBouncer
before a 3rd replica (see §6).

**Sizing rule of thumb:** ~150–250 MB RSS per Gunicorn worker with threads.
Size container memory as `workers × 250 MB + 200 MB`.

---

## 3. Stage 2 — Horizontal scaling behind a load balancer ✅ implemented

Traefik (already running in Dokploy) is the load balancer. More replicas are
added without any code change:

```bash
docker compose up -d --scale backend=3 --scale frontend=2
```

or by editing `deploy.replicas` in `docker-compose.yml` and redeploying.

What makes multi-replica safe:

| Requirement | How it is satisfied |
|---|---|
| Load balancing | Traefik spreads requests across all replicas of the service |
| Unhealthy replicas removed | Traefik health check on `GET /api/health/` (15s interval) + Docker `HEALTHCHECK` |
| Sessions shared | Cart sessions live in PostgreSQL (`django.contrib.sessions`), not in container memory |
| Rate limits shared | `REDIS_URL` makes throttling counters global instead of per-replica |
| No migration races | Migrations run once in the dedicated `migrate` service; replicas boot with `MIGRATE_ON_BOOT=0` |
| Uploads shared | `media_data` named volume mounted into every backend replica |
| JWT stateless | Any replica can validate any access token — no sticky sessions needed |

### Recommended sizing at 250 concurrent users

| Tier | Spec | Replicas | Purpose |
|---|---|---|---|
| Minimum | 2 vCPU / 4 GB | 1 backend, 1 frontend | Handles the target with no redundancy |
| **Recommended** | **4 vCPU / 8 GB** | **2 backend, 2 frontend** | Handles the target with redundancy; survives one replica dying |
| Campaign day | 8 vCPU / 16 GB | 3–4 backend, 2–3 frontend | Absorbs a 3–5× flash-sale burst |

> The `frontend` (Next.js) is static-asset heavy and cheap; the `backend` + DB
> is almost always the bottleneck.

---

## 4. Stage 3 — Database (do this before adding a 3rd replica)

The database is the first thing to saturate. Work through these in order.

1. **Use PgBouncer (transaction pooling).** Gunicorn **threads** × workers ×
   replicas multiplies connections fast: the compose default 2 replicas ×
   4 workers × 8 threads = up to 64 connections, and a 3rd replica would reach
   ~96 — effectively the default `max_connections` of 100. Add PgBouncer between
   Django and Postgres and set `DB_CONN_MAX_AGE=0` in the app so PgBouncer owns
   pooling. Keep `DB_PORT` pointing at PgBouncer; drop `CONN_MAX_AGE` pressure.
2. **Index for the real query patterns.** Verify with `EXPLAIN ANALYZE` before
   and after, and add only what the plans justify. Candidates:
   - `Product(category_id, in_stock, -created_at)` for filtered catalog listing
   - `Product(in_stock, -created_at)` for the default listing
   - `Product(discount_percent)` partial index `WHERE discount_percent > 0` for `?offered=true`
   - `Order(user_id, -created_at)` for order history
   - `OrderItem(order_id)` (already implied by the FK) and `ProductReview(product_id)`
3. **Right-size Postgres**: `shared_buffers` ≈ 25% of RAM, `effective_cache_size`
   ≈ 50–75% of RAM, `work_mem` 8–16 MB, `max_connections` 100–200 (PgBouncer
   handles the rest).
4. **Separate the database host** from the app host once vertical scaling tops
   out, then add a **read replica** for catalog reads. Route read-only
   endpoints (`/api/catalog/*`, `/api/banners/`) to the replica via a DRF
   database router or `using('replica')` on those querysets.
5. **Analytics/backups off the primary.** Run `pg_dump` and any reporting
   against a replica so they never compete with checkout traffic.

---

## 5. Stage 4 — Caching and offloading static/media

The biggest easy win: **stop making Django serve images.**

1. **Serve `/media/` from the edge, not Django.** Today uploads are streamed by
   a Django view. Put an nginx sidecar (or Traefik file provider) in front of the
   `media_data` volume, or move to object storage (step 4). This removes the
   single heaviest category of backend request.
2. **Put a CDN in front of static and media.** Cloudflare (free tier) works
   well for a Bangladesh audience and also absorbs TLS and DDoS.
3. **Cache slow-changing reads in Redis.** Categories and banners change
   rarely:
   ```python
   from django.core.cache import cache
   data = cache.get_or_set('catalog:categories', compute_categories, 300)
   ```
   Never cache anything user-specific (`/api/orders/`, `/api/auth/me/`) in a
   shared key.
4. **HTTP caching headers** on public GETs so browsers and the CDN can reuse
   them:
   - `/api/catalog/categories/` → `Cache-Control: public, max-age=300`
   - `/api/banners/` → `Cache-Control: public, max-age=600`
   - `/api/catalog/products/` → `Cache-Control: public, max-age=60`
5. **Keep the frontend static.** Next.js already prerenders the marketing pages;
   prefer `revalidate` over forcing everything dynamic.

---

## 6. Stage 5 — Multi-host and object storage

Only needed if a single server (or single point of failure) is no longer
acceptable.

1. **Object storage for media** (S3-compatible; `django-storages` +
   `django-storages` S3 backend). A local named volume cannot be shared across
   hosts. After switching, verify existing media is migrated and `MEDIA_URL`
   points at the bucket/CDN.
2. **Managed PostgreSQL** (with automated backups and PITR) or a primary +
   replica pair with a failover mechanism.
3. **Managed Redis** for cache and (if you later add) Celery.
4. **Two app hosts** behind a cloud load balancer or Traefik on each node, with
   health checks. Now a single host death is not an outage.
5. **Autoscaling** on CPU > 70% or p95 latency > 500 ms, scale in when both
   drop. Keep a floor of 2 backend replicas so a rolling deploy never goes to
   zero capacity.

---

## 7. Configuration reference

| Variable | Default | Notes |
|---|---|---|
| `GUNICORN_WORKERS` | `2×CPU+1` | Lower it on small boxes; each worker ≈ 250 MB |
| `GUNICORN_THREADS` | `4` | Concurrency per worker for I/O-bound requests |
| `GUNICORN_MAX_REQUESTS` | `1000` | Worker recycling; lower if memory grows |
| `DB_CONN_MAX_AGE` | `120` | Set to `0` when fronting Postgres with PgBouncer |
| `REDIS_URL` | *(unset → locmem)* | **Set it** whenever replicas > 1 |
| `PAGE_SIZE` | `20` | Catalog page size; smaller = lighter responses |
| `THROTTLE_ANON` / `THROTTLE_USER` / `THROTTLE_AUTH` | `240/min`, `4000/hour`, `20/min` | Raise if carrier NAT causes false positives |
| `DELIVERY_CHARGE_INSIDE` / `_OUTSIDE` | `60` / `120` | Server-authoritative fees |
| `MIGRATE_ON_BOOT` | `1` | Must be `0` on all but the migration replica |

---

## 8. Load testing (do this before every big campaign)

Test against a **staging** copy with production-like data volumes. Use k6:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // ramp
    { duration: '3m', target: 250 },  // hold 250 concurrent users
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],            // <1% errors
    http_req_duration: ['p(95)<500'],          // p95 under 500 ms
  },
};

const BASE = 'https://staging-api.example.com';

export default function () {
  const list = http.get(`${BASE}/api/catalog/products/`);
  check(list, { 'products 200': (r) => r.status === 200 });

  const detail = http.get(`${BASE}/api/catalog/products/1/`);
  check(detail, { 'detail 200': (r) => r.status === 200 });

  sleep(1);
}
```

Then test the paths that actually strain the system:

- **Browse** — catalog list + detail (most traffic).
- **Auth** — login/register (watch for throttle false positives).
- **Checkout spike** — many users placing orders for the *same* product at once
  to prove the `select_for_update` + rollback logic holds stock exactly
  (no oversell, no phantom orders).
- **Soak** — 250 users for 1–2 hours to expose connection and memory leaks.

### What to watch

| Signal | Where | Alert threshold |
|---|---|---|
| p95 API latency | Traefik / Gunicorn access log | > 500 ms for 5 min |
| 5xx rate | backend logs (`django.request`) | > 1% |
| Postgres connections | `pg_stat_activity` | > 80% of `max_connections` |
| Postgres slow queries | `pg_stat_statements` | any > 200 ms regularly |
| CPU per host | host metrics | > 70% sustained |
| Memory per container | Docker stats | approaching limit |
| Redis hit rate / evictions | `redis-cli info` | evictions > 0 while cache is warm |

---

## 9. Rollout checklist

1. Set the real values for `SECRET_KEY`, `POSTGRES_PASSWORD`, `ALLOWED_HOSTS`,
   `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `REDIS_URL`.
2. Deploy with `deploy.replicas: 2` for backend and frontend.
3. Confirm `GET /api/health/` returns `200` and Traefik reports healthy servers
   for the backend service.
4. Run the k6 browse + checkout-spike scenarios; confirm no 5xx and no oversold
   stock.
5. Add PgBouncer and the verified indexes.
6. Put a CDN in front of static and media; stop serving images through Django.
7. Schedule off-host database backups and **test a restore**.
8. Only then add replica #3 and beyond, or move to multi-host.

---

## 10. Honest limits of the current setup

- **Media is still served by Django.** Fine at today's traffic, first thing to
  offload before a big campaign.
- **No read replica / no PgBouncer yet.** A 3rd+ backend replica will start to
  pressure Postgres connections before it runs out of CPU.
- **`media_data` is a single-host volume.** Multi-host requires object storage.
- **No background job queue.** Emails, invoices and async work should move to
  Celery + Redis before they sit on the request path.
- **Single Postgres instance is a single point of failure.** Backups are
  mandatory; a replica/failover is the durability step.
