"""Single-use, expiring tokens for the links we email out.

Both token kinds are built on Django's ``PasswordResetTokenGenerator`` so they
inherit the same guarantees: the payload is signed with SECRET_KEY, the token is
bound to the user's current state, and it expires after
``settings.PASSWORD_RESET_TIMEOUT``.
"""
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode


class EmailVerificationTokenGenerator(PasswordResetTokenGenerator):
    """Token for the "verify your email" link.

    ``email_verified`` is part of the hash, so the link stops working the moment
    the address is verified — a resend is the only way to get a working link
    again, and a leaked link cannot be replayed.
    """

    key_salt = 'apps.users.tokens.EmailVerificationTokenGenerator'

    def _make_hash_value(self, user, timestamp):
        return f'{user.pk}{timestamp}{user.email_verified}{user.email}'


email_verification_token = EmailVerificationTokenGenerator()


def encode_uid(user):
    """The user's primary key as it appears in an emailed link."""
    return urlsafe_base64_encode(force_bytes(user.pk))


def user_from_uidb64(uid):
    """Resolve a link's ``uid`` to a user, or ``None`` when it is unusable.

    A bad uid is a normal outcome (truncated link, tampered URL), never a 500.
    """
    from .models import User

    try:
        return User.objects.get(pk=force_str(urlsafe_base64_decode(uid)))
    except (TypeError, ValueError, OverflowError, UnicodeDecodeError, User.DoesNotExist):
        return None
