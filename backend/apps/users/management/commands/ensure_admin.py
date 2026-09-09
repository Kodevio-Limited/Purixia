import os
from django.core.management.base import BaseCommand
from apps.users.models import User


class Command(BaseCommand):
    help = 'Create a superuser from env vars if none exists (or update password if ADMIN_RESET_PASSWORD=1)'

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME', '')
        email = os.environ.get('ADMIN_EMAIL', '')
        password = os.environ.get('ADMIN_PASSWORD', '')
        reset = os.environ.get('ADMIN_RESET_PASSWORD', '') == '1'

        if not username or not email or not password:
            self.stdout.write(self.style.WARNING(
                'ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD not all set — skipping.'
            ))
            return

        # Reset existing user's password
        if reset:
            try:
                user = User.objects.get(username=username)
                user.set_password(password)
                user.is_staff = True
                user.is_superuser = True
                user.email = email
                user.save()
                self.stdout.write(self.style.SUCCESS(
                    f'Reset password for superuser "{username}" and ensured staff/superuser flags.'
                ))
                return
            except User.DoesNotExist:
                pass  # fall through to create

        # Create if no superuser exists with this username
        if User.objects.filter(username=username).exists():
            self.stdout.write(f'User "{username}" already exists — skipping creation.')
            return

        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )
        self.stdout.write(self.style.SUCCESS(
            f'Created superuser "{username}" ({email})'
        ))
