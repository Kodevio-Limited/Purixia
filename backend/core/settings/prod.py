from .base import *  # noqa
from decouple import config

DEBUG = False

ALLOWED_HOSTS = ['*']

# ── Database: SQLite (Keeping it built-in as requested) ────────────────────────
import os
DATABASE_PATH = config('SQLITE_DB_PATH', default=str(BASE_DIR / 'db.sqlite3'))
os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': DATABASE_PATH,
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
CSRF_TRUSTED_ORIGINS = [
    'https://purixia.vercel.app',
    'https://purixia.kodevio.com',
    'https://purixia.kodevio.com',
]

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