"""Gunicorn configuration for the Purixia API.

Tuned for a mostly I/O-bound DRF API serving hundreds of concurrent shoppers.

Why `gthread` instead of plain sync workers:
  A sync worker handles one request at a time, so concurrency == worker count.
  With threads, each worker multiplexes several in-flight requests while it
  waits on the database, which raises throughput without ballooning memory.

All knobs are overridable with environment variables so a replica can be tuned
without rebuilding the image.

Resource budget per worker (measured on this app, with preload_app enabled):
  * ~50 MB incremental RSS per worker (the app itself is shared via fork)
  * 1 persistent database connection per *thread* (Django opens one per
    handling thread and, with CONN_MAX_AGE > 0, keeps it). With `threads`
    threads and `workers` workers that is threads x workers connections per
    replica — budget for it (see DEPLOYMENT.md "connection budget").
"""
import multiprocessing
import os

bind = os.getenv('GUNICORN_BIND', '0.0.0.0:8000')

# Inside a container `cpu_count()` frequently reports the HOST's cores, which
# would massively over-provision workers (and therefore DB connections). Prefer
# CPU affinity, and cap the default regardless; GUNICORN_WORKERS overrides it.
MAX_DEFAULT_WORKERS = 8


def _available_cpus():
    try:
        return max(1, len(os.sched_getaffinity(0)))
    except (AttributeError, OSError):
        return multiprocessing.cpu_count()


# 2 * CPU + 1 is the classic starting point; threads multiply how many requests
# each worker can serve while it waits on the database.
_workers_override = os.getenv('GUNICORN_WORKERS', '').strip()
workers = max(
    1,
    int(_workers_override) if _workers_override
    else min(2 * _available_cpus() + 1, MAX_DEFAULT_WORKERS),
)
worker_class = os.getenv('GUNICORN_WORKER_CLASS', 'gthread')
threads = max(1, int(os.getenv('GUNICORN_THREADS', '4')))

# Keep worker heartbeat files off the (slow) container disk when possible.
if os.path.isdir('/dev/shm'):
    worker_tmp_dir = '/dev/shm'

# ── Shutdown behaviour ───────────────────────────────────────────────────────
# On SIGTERM Gunicorn stops accepting new connections and lets in-flight
# requests finish for up to `graceful_timeout` seconds before killing workers.
# The container must therefore be allowed to live at least that long: see
# `stop_grace_period: 40s` on the backend service in docker-compose.yml. With
# Docker's default 10s the container would be SIGKILLed mid-request, so a
# rolling restart would drop traffic.
timeout = int(os.getenv('GUNICORN_TIMEOUT', '60'))
graceful_timeout = int(os.getenv('GUNICORN_GRACEFUL_TIMEOUT', '30'))
keepalive = int(os.getenv('GUNICORN_KEEPALIVE', '5'))

# Recycle workers periodically to contain slow memory growth from leaks.
#
# Raised from 1000 to 5000 after load testing showed worker recycling causes
# intermittent 502s: when a worker exits, the load balancer (Traefik) can still
# hold/reuse a connection to it for a moment and fails the request instantly.
# A/B testing proved the link (0 failures at 120s with recycling disabled,
# 3-4 per 90-120s at 1000) and ruled out keepalive, idle timeout and retries.
# A higher threshold keeps the leak safety net while making the window rare.
# Note: worker recycling is also *why deploys must drain before restart* — see
# DEPLOYMENT.md.
max_requests = int(os.getenv('GUNICORN_MAX_REQUESTS', '5000'))
max_requests_jitter = int(os.getenv('GUNICORN_MAX_REQUESTS_JITTER', '100'))

# Trust X-Forwarded-* from the reverse proxy (Traefik) for client IP / scheme.
forwarded_allow_ips = os.getenv('GUNICORN_FORWARDED_ALLOW_IPS', '*')

accesslog = os.getenv('GUNICORN_ACCESS_LOG', '-')
errorlog = os.getenv('GUNICORN_ERROR_LOG', '-')
loglevel = os.getenv('GUNICORN_LOG_LEVEL', 'info')

preload_app = True
