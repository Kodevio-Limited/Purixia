from pathlib import Path
from datetime import timedelta
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY = config('SECRET_KEY')
AUTH_USER_MODEL = 'users.User'

# ── Apps ──────────────────────────────────────────────────────────────────────
DJANGO_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
]
LOCAL_APPS = [
    'apps.users',
    'apps.catalog',
    'apps.orders',
    'apps.banners',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ── Middleware ─────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    # Probes first: Traefik/Docker check the container directly (Host =
    # container IP), which ALLOWED_HOSTS rejects. Exact-path match only.
    'core.middleware.HealthProbeMiddleware',
    # Second: every response carries X-Request-ID and every log line carries
    # the same ID (see core/middleware.py + core/logging.py).
    'core.middleware.RequestIDMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'
WSGI_APPLICATION = 'core.wsgi.application'

# ── Templates ─────────────────────────────────────────────────────────────────
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ── Password validation ────────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ── Internationalisation ───────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'Asia/Dhaka'
USE_I18N      = True
USE_TZ        = True

# ── Static & Media ────────────────────────────────────────────────────────────
STATIC_URL  = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL   = '/media/'
MEDIA_ROOT  = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ── Jazzmin Admin Theme ──────────────────────────────────────────────────────────
JAZZMIN_SETTINGS = {
    'site_title': 'Purixia BD Admin',
    'site_header': 'Purixia BD',
    'site_brand': 'Purixia BD',
    'site_logo': None,
    'login_logo': None,
    'login_logo_dark': None,
    'site_logo_classes': 'img-circle',
    'site_icon': None,
    'welcome_sign': 'Welcome to Purixia BD Admin',
    'copyright': 'Purixia BD',
    'search_model': ['auth.User', 'catalog.Product'],
    'user_avatar': None,
    'topmenu_links': [
        {'name': 'Home', 'url': 'admin:index', 'permissions': ['auth.view_user']},
        {'name': 'View Site', 'url': '/', 'new_window': True},
    ],
    'usermenu_links': [
        {'name': 'View Site', 'url': '/', 'new_window': True, 'icon': 'fas fa-external-link-alt'},
    ],
    'show_sidebar': True,
    'navigation_expanded': True,
    'hide_apps': [],
    'hide_models': [],
    'order_with_respect_to': ['catalog', 'orders', 'banners', 'users', 'auth'],
    'custom_links': {},
    'icons': {
        'auth.User': 'fas fa-users',
        'auth.Group': 'fas fa-users-cog',
        'users.User': 'fas fa-user',
        'catalog.Category': 'fas fa-tags',
        'catalog.Product': 'fas fa-box-open',
        'catalog.ProductImage': 'fas fa-images',
        'orders.Order': 'fas fa-shopping-cart',
        'orders.OrderItem': 'fas fa-receipt',
        'orders.ShippingInfo': 'fas fa-truck',
        'banners.Banner': 'fas fa-ad',
    },
    'default_icon_parents': 'fas fa-chevron-circle-right',
    'default_icon_children': 'fas fa-circle',
    'related_modal_active': True,
    'custom_css': None,
    'custom_js': None,
    'use_google_fonts_cdn': True,
    'show_ui_builder': False,
    'changeform_format': 'horizontal_tabs',
    'changeform_format_overrides': {
        'auth.User': 'collapsible',
        'auth.Group': 'vertical_tabs',
    },
    'language_chooser': False,
}

JAZZMIN_UI_TWEAKS = {
    'navbar_small_text': False,
    'footer_small_text': False,
    'body_small_text': False,
    'brand_small_text': False,
    'brand_colour': 'navbar-warning',
    'accent': 'accent-warning',
    'navbar': 'navbar-white navbar-light',
    'no_navbar_border': True,
    'navbar_fixed': True,
    'layout_boxed': False,
    'footer_fixed': False,
    'sidebar_fixed': True,
    'sidebar': 'sidebar-dark-warning',
    'sidebar_nav_small_text': False,
    'sidebar_disable_expand': False,
    'sidebar_nav_child_indent': True,
    'sidebar_nav_compact_style': False,
    'sidebar_nav_legacy_style': False,
    'sidebar_nav_flat_style': True,
    'theme': 'minty',
    'dark_mode_theme': 'darkly',
    'button_classes': {
        'primary': 'btn-warning',
        'secondary': 'btn-outline-warning',
        'info': 'btn-info',
        'warning': 'btn-warning',
        'danger': 'btn-danger',
        'success': 'btn-success',
    },
    'actions_sticky_top': True,
}

# ── Cache ─────────────────────────────────────────────────────────────────────
# Redis is a *hard requirement* in production (enforced in core/settings/prod.py)
# because rate-limit counters must be shared between replicas. The in-process
# fallback below exists for dev/test only — it is per-worker, so with more than
# one worker each would track its own counters.
REDIS_URL = config('REDIS_URL', default='')
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': REDIS_URL,
            'KEY_PREFIX': 'purixia',
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'purixia-local',
        }
    }

# ── Delivery charges (authoritative, server-side only) ───────────────────────
DELIVERY_CHARGE_INSIDE  = config('DELIVERY_CHARGE_INSIDE',  default=60,  cast=int)
DELIVERY_CHARGE_OUTSIDE = config('DELIVERY_CHARGE_OUTSIDE', default=120, cast=int)

# ── COD abuse protection ──────────────────────────────────────────────────────
# How many orders that are still awaiting fulfilment (pending/confirmed) one
# account may hold at once. Cash on delivery means an unpaid order is a real
# commitment, so the cap keeps one account from stockpiling them.
MAX_OPEN_ORDERS = config('MAX_OPEN_ORDERS', default=1, cast=int)

# ── DRF ───────────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'apps.users.auth.SafeJWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': config('PAGE_SIZE', default=20, cast=int),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    # Baseline abuse protection. Auth endpoints use a tighter scoped throttle.
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': config('THROTTLE_ANON', default='240/min'),
        'user': config('THROTTLE_USER', default='4000/hour'),
        'auth': config('THROTTLE_AUTH', default='20/min'),
        # Order placement is deliberately tighter than the global budget: a real
        # customer never places ten orders in an hour, a script does it in
        # seconds. Shared through the cache, so the limit holds across replicas.
        'order': config('THROTTLE_ORDER', default='10/hour'),
        # Endpoints that send an email (password reset, verification resend).
        # Low, because each hit costs a message and could be aimed at a victim.
        'email_send': config('THROTTLE_EMAIL_SEND', default='5/hour'),
    },
}

# ── JWT ───────────────────────────────────────────────────────────────────────
SIMPLE_JWT = {
    # The access token is short-lived and held in memory by the storefront only.
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES',  default=60,  cast=int)),
    # The refresh token lives in an HttpOnly cookie (see REFRESH_COOKIE_* below).
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7,   cast=int)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ── Refresh-token cookie ──────────────────────────────────────────────────────
# The refresh token is never handed to JavaScript: it travels in an HttpOnly
# cookie, so an XSS bug cannot read it out of localStorage. Only the short-lived
# access token is ever returned in a response body (held in memory by the app).
REFRESH_COOKIE_NAME = config('REFRESH_COOKIE_NAME', default='purixia_refresh')
# Scoped to the auth endpoints so it is not attached to every API request.
REFRESH_COOKIE_PATH = config('REFRESH_COOKIE_PATH', default='/api/auth/')
# Lax is correct when the storefront and API are the same site (purixiabd.com and
# admin.purixiabd.com share the eTLD+1): the cookie is first-party and is not
# sent on cross-site POSTs, which is what stops CSRF via the cookie. Set
# REFRESH_COOKIE_SAMESITE=None only if the frontend becomes a different site,
# and remember that browsers require Secure for None.
REFRESH_COOKIE_SAMESITE = config('REFRESH_COOKIE_SAMESITE', default='Lax')
REFRESH_COOKIE_SECURE = config('REFRESH_COOKIE_SECURE', default=False, cast=bool)
# Leave empty normally; set to ".purixiabd.com" to share the cookie across
# subdomains (e.g. if the API moves under the same host).
REFRESH_COOKIE_DOMAIN = config('REFRESH_COOKIE_DOMAIN', default='') or None

# ── Transactional email (password reset + email verification) ─────────────────
# Console backend by default so local development needs no mail server.
# Production switches to SMTP when EMAIL_HOST is set (see core/settings/prod.py);
# sending is always best-effort, so a broken mail server never breaks ordering.
EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_USE_SSL = config('EMAIL_USE_SSL', default=False, cast=bool)
EMAIL_TIMEOUT = config('EMAIL_TIMEOUT', default=10, cast=int)
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='Purixia BD <no-reply@purixiabd.com>')

# Base URL of the storefront, used to build the links inside those emails.
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000').rstrip('/')

# How long a reset / verification link stays valid. One knob for both: the reset
# token is also single-use (it is bound to the password hash, so it dies the
# moment it is used), which matters more than a short clock.
PASSWORD_RESET_TIMEOUT = config('PASSWORD_RESET_TIMEOUT', default=60 * 60 * 24, cast=int)

# ── Sentry error reporting (opt-in) ──────────────────────────────────────────
# Empty by default: core/sentry.py only initialises the SDK when a DSN is set
# (from core/wsgi.py, the production entrypoint). No DSN → zero overhead, and
# the SDK is never even imported.
SENTRY_DSN = config('SENTRY_DSN', default='').strip()
SENTRY_ENVIRONMENT = config('SENTRY_ENVIRONMENT', default='production')
SENTRY_TRACES_SAMPLE_RATE = config('SENTRY_TRACES_SAMPLE_RATE', default=0.1, cast=float)
