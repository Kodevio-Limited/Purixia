"""Tests for the production fail-fast guards.

The guards run at import time by design: a production process must refuse to
boot with a missing or guessable secret rather than fall back to an insecure
default. So these tests import ``core.settings.prod`` in isolation, with a
controlled environment, instead of calling a function.

Note: python-decouple gives ``os.environ`` precedence over the ``.env`` file,
so an explicit empty override is enough to simulate a missing value (verified
empirically against this project's setup).
"""
import importlib
import os
import sys
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.http import JsonResponse
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings

STRONG_SECRET_KEY = 'k' * 48  # long enough, and not in the placeholder list
PLACEHOLDER_SECRET_KEY = 'replace-me-with-a-random-32-plus-character-value'

MANAGED_MODULES = ('core.settings.base', 'core.settings.prod')

VALID_ENV = {
    'SECRET_KEY': STRONG_SECRET_KEY,
    'ALLOWED_HOSTS': 'purixiabd.com',
    'DB_PASSWORD': 'db-password',
    'POSTGRES_PASSWORD': 'db-password',
    'REDIS_URL': 'redis://redis:6379/0',
}


def load_prod_settings(**env_overrides):
    """Import ``core.settings.prod`` fresh with ``env_overrides`` applied."""
    saved = {name: sys.modules.get(name) for name in MANAGED_MODULES}
    for name in MANAGED_MODULES:
        sys.modules.pop(name, None)
    try:
        with mock.patch.dict(os.environ, env_overrides, clear=False):
            return importlib.import_module('core.settings.prod')
    finally:
        # Restore the previously loaded modules so other tests are unaffected.
        for name in MANAGED_MODULES:
            sys.modules.pop(name, None)
            if saved[name] is not None:
                sys.modules[name] = saved[name]


class ProductionSecretKeyGuardTests(SimpleTestCase):
    def test_empty_secret_key_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            load_prod_settings(**{**VALID_ENV, 'SECRET_KEY': ''})

    def test_short_secret_key_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            load_prod_settings(**{**VALID_ENV, 'SECRET_KEY': 'too-short'})

    def test_placeholder_secret_key_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            load_prod_settings(**{**VALID_ENV, 'SECRET_KEY': PLACEHOLDER_SECRET_KEY})

    def test_strong_secret_key_is_accepted(self):
        prod = load_prod_settings(**VALID_ENV)
        self.assertEqual(prod.SECRET_KEY, STRONG_SECRET_KEY)
        self.assertFalse(prod.DEBUG)


class ProductionHostAndDatabaseGuardTests(SimpleTestCase):
    def test_empty_allowed_hosts_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            load_prod_settings(**{**VALID_ENV, 'ALLOWED_HOSTS': ''})

    def test_wildcard_allowed_hosts_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            load_prod_settings(**{**VALID_ENV, 'ALLOWED_HOSTS': '*'})

    def test_missing_database_password_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            load_prod_settings(**{
                **VALID_ENV, 'DB_PASSWORD': '', 'POSTGRES_PASSWORD': '',
            })

    def test_missing_redis_url_is_rejected(self):
        with self.assertRaises(ImproperlyConfigured):
            load_prod_settings(**{**VALID_ENV, 'REDIS_URL': ''})

    def test_valid_environment_produces_locked_down_settings(self):
        prod = load_prod_settings(**VALID_ENV)
        self.assertFalse(prod.DEBUG)
        self.assertFalse(prod.CORS_ALLOW_ALL_ORIGINS)
        self.assertTrue(prod.CORS_ALLOWED_ORIGINS)
        self.assertIn('purixiabd.com', prod.ALLOWED_HOSTS)
        self.assertEqual(prod.REDIS_URL, 'redis://redis:6379/0')


REDIS_CONFIGURED = override_settings(REDIS_URL='redis://redis:6379/0')


class LivenessTests(TestCase):
    def test_liveness_is_ok_even_when_a_dependency_is_down(self):
        with mock.patch('core.views._check_database', return_value='error'):
            response = self.client.get('/api/health/live/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')


class ReadinessTests(TestCase):
    def test_readiness_ok_with_database_and_in_process_cache(self):
        # Test settings have no REDIS_URL, so the cache probe is skipped rather
        # than failed: readiness must not require Redis in dev/test.
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['database'], 'ok')
        self.assertEqual(response.json()['checks']['cache'], 'not-configured')

    def test_readiness_returns_503_when_database_fails(self):
        with mock.patch('core.views._check_database', return_value='error'):
            response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['status'], 'error')

    @REDIS_CONFIGURED
    def test_readiness_returns_503_when_cache_fails(self):
        with mock.patch('core.views.cache') as fake_cache:
            fake_cache.set.side_effect = ConnectionError('redis is down')
            response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['checks']['cache'], 'error')

    @REDIS_CONFIGURED
    def test_readiness_probes_the_cache_when_redis_is_configured(self):
        with mock.patch('core.views.cache') as fake_cache:
            fake_cache.get.return_value = 'ok'
            response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['checks']['cache'], 'ok')
        fake_cache.set.assert_called_once()
        fake_cache.delete.assert_called_once()


class RequestIDMiddlewareTests(TestCase):
    def test_response_carries_a_generated_request_id(self):
        response = self.client.get('/api/health/live/')
        self.assertEqual(response.status_code, 200)
        request_id = response['X-Request-ID']
        self.assertTrue(request_id)
        self.assertNotEqual(request_id, '-')
        # Two requests get two IDs.
        again = self.client.get('/api/health/live/')
        self.assertNotEqual(again['X-Request-ID'], request_id)

    def test_incoming_request_id_is_echoed(self):
        response = self.client.get('/api/health/live/', HTTP_X_REQUEST_ID='trace-123')
        self.assertEqual(response['X-Request-ID'], 'trace-123')


class HealthProbeHostTests(TestCase):
    """Probes must answer even when Host is a container IP (Traefik/Docker
    check the container directly); everything else keeps host enforcement."""

    @override_settings(ALLOWED_HOSTS=['example.com'])
    def test_readiness_probe_ignores_host(self):
        response = self.client.get('/api/health/', HTTP_HOST='172.20.0.4:8000')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')

    @override_settings(ALLOWED_HOSTS=['example.com'])
    def test_liveness_probe_ignores_host(self):
        response = self.client.get('/api/health/live/', HTTP_HOST='172.20.0.4:8000')
        self.assertEqual(response.status_code, 200)

    @override_settings(ALLOWED_HOSTS=['example.com'])
    def test_other_paths_still_enforce_host(self):
        response = self.client.get('/api/catalog/products/', HTTP_HOST='evil.example')
        self.assertEqual(response.status_code, 400)


class StructuredLoggingTests(SimpleTestCase):
    def test_request_id_reaches_log_records(self):
        import logging

        from core.logging import RequestIDFilter
        from core.middleware import RequestIDMiddleware

        seen = []

        class Collector(logging.Handler):
            def emit(self, record):
                seen.append(record)

        logger = logging.getLogger('purixia.test.request_id')
        logger.addHandler(Collector())
        logger.addFilter(RequestIDFilter())
        old_level = logger.level
        logger.setLevel(logging.INFO)
        try:
            def view(request):
                logger.info('hello during request')
                return JsonResponse({'ok': True})

            RequestIDMiddleware(view)(RequestFactory().get('/', HTTP_X_REQUEST_ID='trace-xyz'))
        finally:
            logger.setLevel(old_level)
            logger.removeHandler(logger.handlers[-1])
            logger.removeFilter(logger.filters[-1])
        self.assertEqual(len(seen), 1)
        self.assertEqual(seen[0].request_id, 'trace-xyz')

    def test_json_formatter_shape(self):
        import json
        import logging

        from core.logging import JsonFormatter

        record = logging.LogRecord(
            name='purixia.test', level=logging.INFO, pathname=__file__,
            lineno=1, msg='order placed', args=(), exc_info=None,
        )
        record.request_id = 'trace-abc'
        payload = json.loads(JsonFormatter().format(record))
        self.assertEqual(payload['level'], 'INFO')
        self.assertEqual(payload['logger'], 'purixia.test')
        self.assertEqual(payload['msg'], 'order placed')
        self.assertEqual(payload['request_id'], 'trace-abc')
        self.assertIn('ts', payload)


class SentryInitTests(SimpleTestCase):
    def test_no_dsn_leaves_sdk_untouched(self):
        from core.sentry import init_sentry

        before = set(sys.modules)
        with override_settings(SENTRY_DSN=''):
            self.assertFalse(init_sentry())
        # The SDK was never even imported: zero overhead, zero risk.
        self.assertEqual(set(sys.modules) - before, set())

    def test_dsn_initialises_sdk_without_pii(self):
        import types

        from core.sentry import init_sentry

        fake_sdk = types.ModuleType('sentry_sdk')
        fake_sdk.init = mock.Mock()
        with mock.patch.dict(sys.modules, {
            'sentry_sdk': fake_sdk,
            'sentry_sdk.integrations': types.ModuleType('sentry_sdk.integrations'),
            'sentry_sdk.integrations.django': types.ModuleType('sentry_sdk.integrations.django'),
        }), override_settings(
            SENTRY_DSN='https://key@sentry.io/1',
            SENTRY_ENVIRONMENT='test',
            SENTRY_TRACES_SAMPLE_RATE=0.0,
        ):
            sys.modules['sentry_sdk.integrations.django'].DjangoIntegration = mock.Mock(
                return_value='integration',
            )
            self.assertTrue(init_sentry())
        _, kwargs = fake_sdk.init.call_args
        self.assertEqual(kwargs['dsn'], 'https://key@sentry.io/1')
        self.assertEqual(kwargs['environment'], 'test')
        self.assertFalse(kwargs['send_default_pii'])
        self.assertEqual(kwargs['integrations'], ['integration'])

    def test_dsn_without_package_warns_and_continues(self):
        import builtins

        from core.sentry import init_sentry

        real_import = builtins.__import__

        def blocked(name, *args, **kwargs):
            if name == 'sentry_sdk' or name.startswith('sentry_sdk.'):
                raise ImportError('blocked for test')
            return real_import(name, *args, **kwargs)

        with mock.patch('builtins.__import__', side_effect=blocked), override_settings(
            SENTRY_DSN='https://key@sentry.io/1',
        ):
            with self.assertLogs('core.sentry', level='WARNING') as logs:
                self.assertFalse(init_sentry())
        self.assertTrue(any('not installed' in line for line in logs.output))


class CorsPreflightTests(TestCase):
    """The storefront sends Idempotency-Key on order placement; the browser
    preflight must echo it in Access-Control-Allow-Headers or the POST is
    blocked client-side."""

    @override_settings(CORS_ALLOW_ALL_ORIGINS=False, CORS_ALLOWED_ORIGINS=['https://purixiabd.com'])
    def test_order_preflight_allows_idempotency_key(self):
        res = self.client.options(
            '/api/orders/place/',
            HTTP_ORIGIN='https://purixiabd.com',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='authorization,content-type,idempotency-key',
        )
        self.assertEqual(res.status_code, 200)
        self.assertIn('idempotency-key', res['access-control-allow-headers'].lower())

    @override_settings(CORS_ALLOW_ALL_ORIGINS=False, CORS_ALLOWED_ORIGINS=['https://purixiabd.com'])
    def test_preflight_disallowed_origin_gets_no_cors_headers(self):
        res = self.client.options(
            '/api/orders/place/',
            HTTP_ORIGIN='https://evil.example',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
        )
        self.assertNotIn('access-control-allow-origin', res)
