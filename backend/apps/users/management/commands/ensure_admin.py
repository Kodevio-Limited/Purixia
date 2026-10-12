import os

from django.core.management.base import BaseCommand

from apps.users.models import User


class Command(BaseCommand):
    help = (
        'Ensure the admin account from env vars exists. Creates it if missing; '
        'resets its password ONLY when ADMIN_RESET_PASSWORD=1. With that flag '
        'unset or 0 an existing account is left completely untouched, so the '
        'admin and its password persist across redeploys.'
    )

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME', '').strip()
        email = os.environ.get('ADMIN_EMAIL', '').strip()
        password = os.environ.get('ADMIN_PASSWORD', '')
        # The only condition under which an existing password is ever changed.
        reset = os.environ.get('ADMIN_RESET_PASSWORD', '').strip() == '1'

        if not username or not email or not password:
            self.stdout.write(self.style.WARNING(
                'ensure_admin: ADMIN_USERNAME/ADMIN_EMAIL/ADMIN_PASSWORD are not '
                'all set — skipping. Existing admin accounts are unaffected.'
            ))
            return

        exists = User.objects.filter(username=username).exists()

        if reset:
            if not exists:
                self._create(username, email, password)
                return
            user = User.objects.get(username=username)
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.email = email
            user.save()
            self.stdout.write(self.style.WARNING(
                f'ensure_admin: RESET the password for "{username}" because '
                f'ADMIN_RESET_PASSWORD=1. Set it back to 0, or the next deploy '
                f'will reset it again.'
            ))
            return

        if exists:
            # The normal, safe path: an admin created once keeps working forever.
            self.stdout.write(
                f'ensure_admin: "{username}" already exists — password left '
                f'unchanged (set ADMIN_RESET_PASSWORD=1 only to force a reset).'
            )
            return

        self._create(username, email, password)

    def _create(self, username, email, password):
        User.objects.create_superuser(username=username, email=email, password=password)
        self.stdout.write(self.style.SUCCESS(
            f'ensure_admin: created superuser "{username}" ({email})'
        ))
