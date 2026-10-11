from decimal import Decimal

from django.conf import settings
from django.db import models, transaction
from apps.catalog.models import Product


class DeliveryType(models.TextChoices):
    INSIDE  = 'inside',  'Inside Dhaka'
    OUTSIDE = 'outside', 'Outside Dhaka'


class PaymentMethod(models.TextChoices):
    COD    = 'cod',   'Cash on Delivery'
    CARD   = 'card',  'Card'
    BKASH  = 'bkash', 'bKash'
    NAGAD  = 'nagad', 'Nagad'


class OrderStatus(models.TextChoices):
    PENDING   = 'pending',   'Pending'
    CONFIRMED = 'confirmed', 'Confirmed'
    SHIPPED   = 'shipped',   'Shipped'
    DELIVERED = 'delivered', 'Delivered'
    CANCELLED = 'cancelled', 'Cancelled'


# Orders that still owe the customer a delivery. Used to cap how many open
# cash-on-delivery orders one account may hold at once.
OPEN_STATUSES = (OrderStatus.PENDING, OrderStatus.CONFIRMED)

# The only legal moves. Anything not listed here is refused, so an order can
# never go backwards (delivered -> pending) or skip a step (pending -> shipped).
ALLOWED_STATUS_TRANSITIONS = {
    OrderStatus.PENDING:   {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.SHIPPED, OrderStatus.CANCELLED},
    OrderStatus.SHIPPED:   {OrderStatus.DELIVERED, OrderStatus.CANCELLED},
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}


class InvalidStatusTransition(Exception):
    """Raised when an order is moved along a status path that is not allowed."""


def delivery_charge_for(delivery_type: str) -> Decimal:
    """Authoritative delivery fee for a delivery type.

    Server-side only: the price shown at checkout mirrors this value but is
    never trusted for the amount actually charged.
    """
    inside = Decimal(str(getattr(settings, 'DELIVERY_CHARGE_INSIDE', 60)))
    outside = Decimal(str(getattr(settings, 'DELIVERY_CHARGE_OUTSIDE', 120)))
    return outside if delivery_type == DeliveryType.OUTSIDE else inside


class ShippingInfo(models.Model):
    name    = models.CharField(max_length=200)
    email   = models.EmailField()
    phone   = models.CharField(max_length=20)
    address = models.TextField()

    def __str__(self):
        return f'{self.name} — {self.phone}'


class Order(models.Model):
    user           = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='orders')
    shipping_info  = models.OneToOneField(ShippingInfo, on_delete=models.PROTECT)
    delivery_type  = models.CharField(max_length=20, choices=DeliveryType.choices, default=DeliveryType.INSIDE)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.COD)
    status         = models.CharField(
        max_length=20,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING,
        db_index=True,
    )
    # Delivery fee is always computed server-side (never trusted from the client).
    delivery_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # Grand total = sum of order items + delivery_charge.
    total_amount   = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    # Identifies one checkout attempt, so POST /api/orders/place/ is idempotent:
    # seeing the same key again returns the order already created instead of
    # placing a second one. Nullable because orders created by hand in the admin
    # (or by a client that sends no key) have none — Postgres treats NULLs as
    # distinct, so any number of keyless orders can coexist.
    idempotency_key = models.CharField(max_length=64, null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            # One key can never produce two orders for the same user, even if
            # two identical requests arrive at the same instant.
            models.UniqueConstraint(
                fields=['user', 'idempotency_key'],
                name='orders_unique_idempotency_key_per_user',
            ),
        ]

    def __str__(self):
        return f'Order #{self.id} — {self.user}'

    @property
    def items_subtotal(self):
        """Sum of the order line items, excluding delivery."""
        return sum((item.subtotal for item in self.items.all()), Decimal('0'))

    @property
    def is_open(self):
        """True while the order still owes a delivery (pending/confirmed)."""
        return self.status in OPEN_STATUSES

    def can_transition_to(self, new_status):
        """Whether ``new_status`` is a legal next step from the current one."""
        return new_status in ALLOWED_STATUS_TRANSITIONS.get(self.status, set())

    def transition_to(self, new_status):
        """Move to ``new_status``, or raise ``InvalidStatusTransition``.

        Going through this method (instead of writing ``status`` directly) is
        what guarantees two things: an illegal jump is refused, and cancelling
        an order puts its stock back into the catalog exactly once.
        """
        if new_status == self.status:
            return self.status
        if not self.can_transition_to(new_status):
            raise InvalidStatusTransition(
                f'An order that is "{self.status}" cannot be changed to "{new_status}".'
            )

        with transaction.atomic():
            # Re-read under a row lock: two admins cancelling the same order at
            # the same time must not both restore its stock.
            locked = Order.objects.select_for_update().get(pk=self.pk)
            if not locked.can_transition_to(new_status):
                raise InvalidStatusTransition(
                    f'An order that is "{locked.status}" cannot be changed to "{new_status}".'
                )
            if new_status == OrderStatus.CANCELLED:
                locked._restore_stock()
            locked.status = new_status
            locked.save(update_fields=['status', 'updated_at'])

        self.status = new_status
        return self.status

    def _restore_stock(self):
        """Put every line item's quantity back into the catalog.

        Must be called inside ``transaction.atomic()``. Rows are locked in
        ascending id order, matching the order-placement path, so concurrent
        cancellations cannot deadlock against a checkout.
        """
        for item in self.items.all().order_by('product_id'):
            product = Product.objects.select_for_update().get(pk=item.product_id)
            product.quantity += item.quantity
            product.in_stock = product.quantity > 0
            product.save(update_fields=['quantity', 'in_stock', 'updated_at'])


class OrderItem(models.Model):
    order      = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product    = models.ForeignKey(Product, on_delete=models.PROTECT)
    quantity   = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    @property
    def subtotal(self):
        if self.unit_price is not None and self.quantity is not None:
            return self.unit_price * self.quantity
        return 0

    def __str__(self):
        return f'{self.quantity}x {self.product.name}'