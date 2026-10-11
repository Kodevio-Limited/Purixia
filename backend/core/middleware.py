"""Request ID middleware.

Every response carries an ``X-Request-ID`` header and every log line written
while handling that request carries the same ID, so a customer report ("my
checkout failed at 14:02") maps to one greppable value across all replicas.

* If the caller (frontend, Traefik, a retrying client) already sent
  ``X-Request-ID``, it is echoed back — trusting it is safe because it is
  only ever used as a log label, never for auth or routing.
* Otherwise a random hex ID is generated.
* The value lives in a :class:`contextvars.ContextVar`, which is safe under
  Gunicorn's ``gthread`` workers (each request runs in its own thread and
  therefore its own context).

See ``core/logging.py`` for the log side.
"""
import uuid
from contextvars import ContextVar

REQUEST_ID_HEADER = 'X-Request-ID'

# 64 chars is enough for any tracing prefix a proxy might add; longer values
# are truncated so one client cannot bloat every log line.
MAX_INCOMING_LENGTH = 64

_request_id_ctx: ContextVar[str] = ContextVar('purixia_request_id', default='-')


def get_request_id() -> str:
    """The ID of the request being handled right now, or ``'-'`` outside one
    (management commands, startup, tests that bypass the middleware)."""
    return _request_id_ctx.get()


def _assign_request_id(request):
    """Pick the request's ID (echoed or generated) and publish it.

    Returns ``(request_id, reset_token)``; the caller must reset the token
    after the response is built. Shared by both middlewares so *every*
    response — including health probes — carries the header.
    """
    incoming = (request.headers.get(REQUEST_ID_HEADER) or '').strip()
    request_id = incoming[:MAX_INCOMING_LENGTH] or uuid.uuid4().hex
    return request_id, _request_id_ctx.set(request_id)


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id, token = _assign_request_id(request)
        try:
            response = self.get_response(request)
        finally:
            _request_id_ctx.reset(token)
        response[REQUEST_ID_HEADER] = request_id
        return response


class HealthProbeMiddleware:
    """Answer load-balancer probes without Host validation.

    Traefik and the Docker HEALTHCHECK connect to the container directly, so
    the ``Host`` header is a container IP/hostname (e.g.
    ``172.20.0.4:8000``) — which ``ALLOWED_HOSTS`` rightly rejects with 400.
    Without this bypass every replica looks permanently unhealthy and Traefik
    serves 503 "no available server".

    Safe because it matches two exact paths only, runs before
    ``CommonMiddleware`` (which is what triggers host validation), and the
    probes return status strings with no user data, no redirects and nothing
    reflecting the Host header — there is nothing to poison or leak.
    """

    READINESS_PATH = '/api/health/'
    LIVENESS_PATH = '/api/health/live/'

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # request.path uses PATH_INFO only — no host validation involved.
        if request.path == self.READINESS_PATH:
            from .views import health
            return self._probe_response(request, health)
        if request.path == self.LIVENESS_PATH:
            from .views import liveness
            return self._probe_response(request, liveness)
        return self.get_response(request)

    @staticmethod
    def _probe_response(request, view):
        # Probes skip the rest of the chain (including RequestIDMiddleware),
        # so assign the ID here to keep the "every response carries it"
        # guarantee uniform.
        request_id, token = _assign_request_id(request)
        try:
            response = view(request)
        finally:
            _request_id_ctx.reset(token)
        response[REQUEST_ID_HEADER] = request_id
        return response
