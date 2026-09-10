from .base import *  # noqa
from decouple import config, Csv
from django.core.exceptions import ImproperlyConfigured

DEBUG = False

ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='*', cast=Csv())

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
        'CONN_MAX_AGE': 600,
        'CONN_HEALTH_CHECKS': True,
        'OPTIONS': {'connect_timeout': 10},
    }
}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Merge any env-provided origins into allowed list (still send ACAO for all)
_existing = [o.strip() for o in config('CORS_ALLOWED_ORIGINS', default='').split(',') if o.strip()]
if _existing:
    CORS_ALLOWED_ORIGINS = _existing

# ── CSRF ──────────────────────────────────────────────────────────────────────
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())

# ── SSL Proxy ─────────────────────────────────────────────────────────────────
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# ── Security headers ──────────────────────────────────────────────────────────
SECURE_HSTS_SECONDS            = 31_536_000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD            = True
SECURE_SSL_REDIRECT            = False  # nginx handles SSL termination
SESSION_COOKIE_SECURE          = True
SESSION_COOKIE_SAMESITE        = 'None'
CSRF_COOKIE_SECURE             = True
SECURE_CONTENT_TYPE_NOSNIFF    = True
SECURE_BROWSER_XSS_FILTER      = True
X_FRAME_OPTIONS                = 'DENY'

# ── Static files (WhiteNoise) ─────────────────────────────────────────────────
# WhiteNoise configuration for serving static files in production
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
STATICFILES_STORAGE = 'django.contrib.staticfiles.storage.StaticFilesStorage'

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django.request': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}