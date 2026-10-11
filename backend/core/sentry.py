"""Sentry error reporting (backend).

Enabled only when ``SENTRY_DSN`` is set — otherwise this module is a no-op
and ``sentry-sdk`` is never imported, so local dev and tests run exactly as
before. Called once from ``core/wsgi.py`` (the production entrypoint), not
from settings, so importing settings can never fail on a missing SDK.

If a DSN *is* set but the package is missing (e.g. an image built before the
dependency was added), startup continues with a loud warning instead of
crashing: losing error reports must never take down the storefront.
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)


def init_sentry() -> bool:
    """Initialise the SDK if configured. Returns True when reporting is on."""
    dsn = (getattr(settings, 'SENTRY_DSN', '') or '').strip()
    if not dsn:
        return False
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
    except ImportError:
        logger.warning(
            'SENTRY_DSN is set but sentry-sdk is not installed: '
            'error reporting is OFF. Add sentry-sdk to requirements.'
        )
        return False
    sentry_sdk.init(
        dsn=dsn,
        environment=getattr(settings, 'SENTRY_ENVIRONMENT', 'production'),
        integrations=[DjangoIntegration()],
        # Performance traces are sampled; errors are always sent.
        traces_sample_rate=float(getattr(settings, 'SENTRY_TRACES_SAMPLE_RATE', 0.1)),
        # Never ship passwords, tokens or cookies to a third party.
        send_default_pii=False,
    )
    logger.info('Sentry error reporting enabled (environment=%s).',
                getattr(settings, 'SENTRY_ENVIRONMENT', 'production'))
    return True
