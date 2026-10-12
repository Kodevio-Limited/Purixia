"""Authentication backend that accepts a username OR an email address.

Context: the storefront logs in with **email** (see
``apps/users/serializers.py::LoginSerializer``) while the Django admin logs in
with **username**. That mismatch is a common source of "correct username and
password for a staff account" confusion, because the admin's field is labelled
"Username" but most operators reach for their email.

This backend keeps Django's standard password checking and the
``is_active``/staff gates (it subclasses ``ModelBackend``); it only widens how
the *identifier* is resolved:

1. exact username,
2. case-insensitive username,
3. case-insensitive email (mirrors the storefront's login).

Duplicate legacy emails are tolerated with ``order_by('id').first()`` (the same
way ``LoginSerializer`` does) so a duplicate can never raise a 500.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend


class EmailOrUsernameBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        UserModel = get_user_model()
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)
        if username is None or password is None:
            return None

        identifier = username.strip()
        user = UserModel.objects.filter(username=identifier).first()
        if user is None:
            user = UserModel.objects.filter(username__iexact=identifier).order_by('id').first()
        if user is None:
            user = UserModel.objects.filter(email__iexact=identifier).order_by('id').first()

        if user is None:
            # Run the hasher so response timing does not reveal whether the
            # identifier exists (no account enumeration).
            UserModel().set_password(password)
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
