"""Structured logging to stdout.

Production emits one JSON object per line (``core/settings/prod.py`` wires
this in): Dokploy/Docker collects container stdout, and JSON lines stay
greppable and parseable when several replicas interleave. Stdlib only — no
new dependencies.

Every record carries ``request_id`` (see ``core/middleware.py``); outside a
request it is ``'-'`` so startup and management-command logs keep the same
shape.
"""
import json
import logging

from .middleware import get_request_id


class RequestIDFilter(logging.Filter):
    """Attach the current request's ID to every log record."""

    def filter(self, record):
        record.request_id = get_request_id()
        return True


class JsonFormatter(logging.Formatter):
    """One flat JSON object per line. Tracebacks stay, as a single string."""

    # ISO-8601 UTC ("2026-10-11T09:30:00.123+00:00"); the container clock is
    # UTC and Asia/Dhaka conversion happens at query time, not in the log.
    default_time_format = '%Y-%m-%dT%H:%M:%S'
    default_msec_format = '%s.%03d+00:00'

    def format(self, record):
        payload = {
            'ts': self.formatTime(record),
            'level': record.levelname,
            'logger': record.name,
            'msg': record.getMessage(),
            'request_id': getattr(record, 'request_id', '-'),
        }
        if record.exc_info and not record.exc_text:
            record.exc_text = self.formatException(record.exc_info)
        if record.exc_text:
            payload['exc'] = record.exc_text
        return json.dumps(payload, default=str)
