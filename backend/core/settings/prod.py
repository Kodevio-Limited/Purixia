from .base import *  # noqa
from decouple import config, Csv
from django.core.exceptions import ImproperlyConfigured

DEBUG = False

# ── Fail-fast startup validation ─────────────────────────────────────────────
# A production process must never boot with a missing, empty or guessable
# secret. There is deliberately no insecure fallback value anywhere.
MIN_SECRET_KEY_LENGTH = 32
PLACEHOLDER_SECRET_KEYS = {
    'changeme',
    'change-me',
    'secret',
    'django-insecure',
    'your-secret-key-here',
    'replace-me-with-a-random-32-plus-character-value',
}

if (
    not SECRET_KEY  # noqa: F821  (inherited from core.settings.base)
    or len(SECRET_KEY) < MIN_SECRET_KEY_LENGTH
    or SECRET_KEY.strip().lower() in PLACEHOLDER_SECRET_KEYS
):
    raise ImproperlyConfigured(
        'SECRET_KEY must be a unique random value of at least '
        f'{MIN_SECRET_KEY_LENGTH} characters in production. Generate one with:\n'
        '  python -c "import secrets; print(secrets.token_urlsafe(64))"'
    )

# ── Hosts ─────────────────────────────────────────────────────────────────────
# Fail fast on a wildcard: serving production with ALLOWED_HOSTS=* is an
# open door for Host-header attacks. Must be an explicit comma-separated list.
ALLOWED_HOSTS = [h.strip() for h in config('ALLOWED_HOSTS', default='').split(',') if h.strip()]
if not ALLOWED_HOSTS or '*' in ALLOWED_HOSTS:
    raise ImproperlyConfigured(
        'Set ALLOWED_HOSTS to your real domains in production '
        '(e.g. purixiabd.com,www.purixiabd.com,admin.purixiabd.com). '
        'A wildcard "*" is not allowed.'
    )

# Traefik terminates TLS and forwards the original Host header.
USE_X_FORWARDED_HOST = True

# ── Database: PostgreSQL (required in production) ────────────────────────────
# Single source of truth for credentials: POSTGRES_* vars (set once in Dokploy).
# DB_* fall back to the POSTGRES_* values so the app and the db service agree.
DB_NAME = config('DB_NAME', default=config('POSTGRES_DB', default='purixia'))
DB_USER = config('DB_USER', default=config('POSTGRES_USER', default='purixia'))
DB_PASSWORD = config('DB_PASSWORD', default=config('POSTGRES_PASSWORD', default=''))
DB_HOST = config('DB_HOST', default='db')
DB_PORT = config('DB_PORT', default='5432')
if not DB_PASSWORD:
    raise ImproperlyConfigured(
        'DB_PASSWORD (or POSTGRES_PASSWORD) must be set in production.'
    )

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': DB_NAME,
        'USER': DB_USER,
        'PASSWORD': DB_PASSWORD,
        'HOST': DB_HOST,
        'PORT': DB_PORT,
        # Persistent connections cut per-request connection overhead. Keep this
        # lower than Postgres max_connections / total worker count.
        'CONN_MAX_AGE': config('DB_CONN_MAX_AGE', default=120, cast=int),
        'CONN_HEALTH_CHECKS': True,
        'OPTIONS': {'connect_timeout': 10},
    }
}

# ── Shared cache (required) ──────────────────────────────────────────────────
# Cache and rate-limit counters must live *outside* the process: with several
# replicas (or even several Gunicorn workers) per-process memory would mean each
# one enforces its own limits and loses them on every deploy or restart.
if not REDIS_URL:  # noqa: F821  (inherited from core.settings.base)
    raise ImproperlyConfigured(
        'REDIS_URL is required in production so cache and rate-limit counters '
        'are shared across replicas. Example: redis://redis:6379/0'
    )

# ── CORS ──────────────────────────────────────────────────────────────────────
# Explicit allow-list only. The storefront talks to the API cross-origin with
# Bearer tokens, so we never need to echo arbitrary origins.
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in config(
        'CORS_ALLOWED_ORIGINS',
        default='https://purixiabd.com,https://www.purixiabd.com',
    ).split(',') if o.strip()
]
if not CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured('CORS_ALLOWED_ORIGINS must list at least one frontend origin.')

# ── Refresh cookie + email overrides for production ───────────────────────────
# Cookies carry the refresh token, so they are Secure (HTTPS only) here. The
# value is forced rather than defaulted: a plain-HTTP refresh cookie would be
# readable by anyone on the network.
REFRESH_COOKIE_SECURE = True

# Transactional email. Missing SMTP config must never stop a customer from
# ordering, so this does not fail the boot — it logs loudly and the mail is
# skipped by apps/users/emails.py, which reports the failure to the caller.
if not EMAIL_HOST:  # noqa: F405
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    import logging as _logging

    _logging.getLogger('core.settings').warning(
        'EMAIL_HOST is not set: password-reset and email-verification messages '
        'will be written to the container log instead of being delivered. Set '
        'EMAIL_HOST/EMAIL_HOST_USER/EMAIL_HOST_PASSWORD to send them.'
    )
else:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# ── CSRF ──────────────────────────────────────────────────────────────────────
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in config(
        'CSRF_TRUSTED_ORIGINS',
        default=','.join(CORS_ALLOWED_ORIGINS),
    ).split(',') if o.strip()
]

# ── SSL / proxy ───────────────────────────────────────────────────────────────
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# ── Security headers ──────────────────────────────────────────────────────────
SECURE_HSTS_SECONDS            = 31_536_000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD            = True
SECURE_SSL_REDIRECT            = False  # Traefik terminates TLS and redirects
SESSION_COOKIE_SECURE          = True
SESSION_COOKIE_HTTPONLY        = True
SESSION_COOKIE_SAMESITE        = 'None'
CSRF_COOKIE_SECURE             = True
SECURE_CONTENT_TYPE_NOSNIFF    = True
SECURE_BROWSER_XSS_FILTER      = True
SECURE_REFERRER_POLICY         = 'same-origin'
X_FRAME_OPTIONS                = 'DENY'

# ── Static files (WhiteNoise) ─────────────────────────────────────────────────
# Django 4.2+ configures static/media storage through STORAGES. WhiteNoise
# compresses assets on collectstatic and adds far-future cache headers.
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}
WHITENOISE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days

# ── Logging ───────────────────────────────────────────────────────────────────
# One JSON object per line on stdout (see core/logging.py): Docker/Dokploy
# collects container stdout, and JSON stays greppable when replicas interleave.
# Nothing is ever written to a file: container disks are ephemeral and each
# replica would keep its own private log. The repo's top-level logs/ folder
# is therefore unused (it holds only a .gitkeep).
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'request_id': {
            '()': 'core.logging.RequestIDFilter',
        },
    },
    'formatters': {
        'json': {
            '()': 'core.logging.JsonFormatter',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
            'filters': ['request_id'],
        },
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}
