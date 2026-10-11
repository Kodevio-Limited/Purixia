"""Operational endpoints used by the load balancer and orchestrator.

Two distinct probes:

* ``/api/health/``      — **readiness**: verifies that this replica can actually
  serve traffic (database *and* shared cache). Returns 503 if either fails, so
  Traefik takes the replica out of rotation instead of sending it requests it
  cannot fulfil.
* ``/api/health/live/`` — **liveness**: verifies only that the process is up.
  Deliberately dependency-free, so a brief database blip does not make an
  orchestrator kill and restart an otherwise healthy container.
"""
import logging
import uuid

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)

# Values a dependency check may report.
OK = 'ok'
ERROR = 'error'
NOT_CONFIGURED = 'not-configured'


def _check_database():
    """Run a trivial query to prove the database is reachable."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
            cursor.fetchone()
        return OK
    except Exception:
        logger.exception('Health check: database probe failed')
        return ERROR


def _check_cache():
    """Round-trip the configured cache so a dead Redis is detected.

    Only probed when REDIS_URL is configured. In dev/test the cache is
    in-process, so there is nothing shared to verify.
    """
    if not getattr(settings, 'REDIS_URL', ''):
        return NOT_CONFIGURED

    key = f'health:{uuid.uuid4().hex}'
    try:
        cache.set(key, 'ok', timeout=10)
        round_tripped = cache.get(key) == 'ok'
        cache.delete(key)
        if not round_tripped:
            raise RuntimeError('cache round-trip returned an unexpected value')
        return OK
    except Exception:
        logger.exception('Health check: cache probe failed')
        return ERROR


def liveness(request):
    """Liveness probe: is the process alive and serving HTTP?"""
    return JsonResponse({'status': OK})


def health(request):
    """Readiness probe: can this replica serve traffic right now?"""
    checks = {
        'database': _check_database(),
        'cache': _check_cache(),
    }
    healthy = all(value in (OK, NOT_CONFIGURED) for value in checks.values())
    return JsonResponse(
        {'status': OK if healthy else ERROR, 'checks': checks},
        status=200 if healthy else 503,
    )
