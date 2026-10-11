"""Transactional email: password reset and email verification.

Sending is deliberately best-effort. This is a cash-on-delivery storefront, so a
misconfigured or unreachable mail server must never break registration, login or
checkout: every failure is logged and reported to the caller as ``False``, and
the caller answers with a message the customer can act on. The console backend
is used whenever SMTP is not configured, so a developer still sees the link.
"""
import logging

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives

from .tokens import encode_uid, email_verification_token

logger = logging.getLogger(__name__)


def _absolute(path: str) -> str:
    return f'{settings.FRONTEND_URL}{path}'


def _send(*, subject, text, to_email, purpose):
    """Send one plain-text email. Returns True on success, never raises."""
    try:
        message = EmailMultiAlternatives(
            subject=subject,
            body=text,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[to_email],
        )
        message.send(fail_silently=False)
        logger.info('Sent %s email to %s', purpose, to_email)
        return True
    except Exception:
        # Log with the stack trace so an operator can fix SMTP, but keep the
        # request alive: the customer can still order without this email.
        logger.exception('Could not send %s email to %s', purpose, to_email)
        return False


def send_password_reset_email(user):
    """Email a single-use reset link to ``user``. Returns True if it went out."""
    link = _absolute(
        f'/reset-password?uid={encode_uid(user)}&token={default_token_generator.make_token(user)}'
    )
    hours = settings.PASSWORD_RESET_TIMEOUT // 3600
    return _send(
        subject='Reset your Purixia BD password',
        text=(
            f'Hello {user.username},\n\n'
            'We received a request to reset your Purixia BD password.\n'
            f'Open this link to choose a new one:\n\n{link}\n\n'
            f'The link works once and expires in {hours} hour(s).\n'
            'If you did not ask for this, you can ignore this email — your\n'
            'password stays unchanged.\n\n'
            '— Purixia BD'
        ),
        to_email=user.email,
        purpose='password-reset',
    )


def send_email_verification_email(user):
    """Email a single-use verification link to ``user``."""
    link = _absolute(
        f'/verify-email?uid={encode_uid(user)}&token={email_verification_token.make_token(user)}'
    )
    return _send(
        subject='Confirm your Purixia BD email address',
        text=(
            f'Hello {user.username},\n\n'
            'Thanks for registering with Purixia BD. Please confirm this email\n'
            f'address by opening:\n\n{link}\n\n'
            'You can keep shopping while this is unconfirmed — confirming just\n'
            'lets us send you order updates reliably.\n\n'
            '— Purixia BD'
        ),
        to_email=user.email,
        purpose='email-verification',
    )
