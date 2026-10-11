from django.db import migrations, models


class Migration(migrations.Migration):
    """Additive only: a new nullable column and a new constraint.

    Existing orders keep `idempotency_key = NULL`, and because PostgreSQL treats
    NULLs as distinct in a unique index, any number of keyless orders can
    coexist for the same user.
    """

    dependencies = [
        ('orders', '0003_order_delivery_charge_and_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='idempotency_key',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddConstraint(
            model_name='order',
            constraint=models.UniqueConstraint(
                fields=('user', 'idempotency_key'),
                name='orders_unique_idempotency_key_per_user',
            ),
        ),
    ]
