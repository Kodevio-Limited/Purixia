from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    phone = models.CharField(max_length=15, blank=True, null = True)
    # Set by the emailed verification link. Ordering is deliberately NOT blocked
    # on it (cash on delivery must never wait for an inbox) — it only records
    # that the address was proven reachable.
    email_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.email