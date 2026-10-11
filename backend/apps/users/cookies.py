"""The refresh-token cookie.

The refresh token is the long-lived credential, so it never appears in a
response body or in JavaScript-readable storage: it travels only in this
HttpOnly cookie, which the browser attaches automatically to the auth
endpoints and no script can read.

Cookie scope (chosen for this deployment):
  * ``Path=/api/auth/``  — narrowest single path that covers both
    ``token/refresh/`` and ``logout/`` (a browser accepts one path per
    cookie), so the token is never attached to catalog/order requests.
  * host-only (no ``Domain``) — the cookie is sent only to
    ``admin.purixiabd.com``, not to every ``*.purixiabd.com`` host.
  * ``SameSite=Lax`` — purixiabd.com and admin.purixiabd.com are the same
    site, so the storefront's credentialed XHR still carries the cookie, but
    a cross-site POST (the classic CSRF vector) does not.
  * ``Secure`` is forced on in production (core/settings/prod.py).
"""
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken


def _max_age():
    """Cookie lifetime matches the refresh-token lifetime."""
    return int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())


def _same_site():
    # '' or None means "omit the attribute"; 'None' must stay the string.
    value = settings.REFRESH_COOKIE_SAMESITE
    return value or None


def set_refresh_cookie(response, refresh_token):
    """Attach a fresh refresh token to ``response`` as an HttpOnly cookie."""
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        str(refresh_token) if isinstance(refresh_token, RefreshToken) else refresh_token,
        max_age=_max_age(),
        path=settings.REFRESH_COOKIE_PATH,
        domain=settings.REFRESH_COOKIE_DOMAIN,
        secure=settings.REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite=_same_site(),
    )
    return response


def clear_refresh_cookie(response):
    """Expire the refresh cookie (same path/domain, so the browser drops it)."""
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        domain=settings.REFRESH_COOKIE_DOMAIN,
        samesite=_same_site(),
    )
    return response


def refresh_token_from_cookie(request):
    """The refresh token the browser sent, or ``None``."""
    return request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
