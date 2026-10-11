from .base import *  # noqa

DEBUG = False

ALLOWED_HOSTS = ['*']

# ── Fast in-memory DB ─────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME':   ':memory:',
    }
}

# ── Skip real migrations for speed ────────────────────────────────────────────
# Uncomment if you install pytest-django + django-test-without-migrations
# MIGRATION_MODULES = {app: None for app in LOCAL_APPS}  # noqa: F405

# ── Faster password hashing in tests ──────────────────────────────────────────
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# `None` rates disable throttling so functional tests don't trip over each other.
# Every scope used by a view must be listed: ScopedRateThrottle raises on an
# unknown scope. Rate-limiting behaviour is tested explicitly by patching these.
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {  # noqa: F405
    'anon': None,
    'user': None,
    'auth': None,
    'order': None,
    'email_send': None,
}


# ── Media: temp folder ────────────────────────────────────────────────────────
import tempfile
MEDIA_ROOT = tempfile.mkdtemp()

# ── Email: never touch a real mail server from tests ──────────────────────────
# Tests assert on the message that *would* have been sent.
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
FRONTEND_URL = 'https://frontend.test'

CORS_ALLOW_ALL_ORIGINS = True