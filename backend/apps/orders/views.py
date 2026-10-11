import logging
import re
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.catalog.models import Product
from .models import (
    OPEN_STATUSES, DeliveryType, Order, OrderItem, ShippingInfo, delivery_charge_for,
)
from .serializers import OrderSerializer, PlaceOrderSerializer

logger = logging.getLogger(__name__)

# Header the storefront uses to make one checkout attempt retry-safe.
IDEMPOTENCY_HEADER = 'Idempotency-Key'
IDEMPOTENCY_KEY_PATTERN = re.compile(r'^[A-Za-z0-9._:-]{8,64}$')


class StockError(Exception):
    """Raised when an order cannot be fulfilled from current inventory."""


class PlaceOrderView(APIView):
    """Create an order and decrement stock atomically.

    Security: prices and delivery fees are resolved from the server, never
    from the request body. A client cannot influence what it is charged.

    The line items always come from the request body: there is deliberately no
    server-side session cart, so checkout never creates an anonymous session
    row (and never relies on per-process state).

    Abuse protection for COD: a per-user placement rate limit (the ``order``
    throttle scope) and a cap on how many unpaid orders one account may hold.
    """

    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'order'

    @staticmethod
    def _merge_items(raw_entries):
        """Collapse repeated products into {product_id: total_quantity}."""
        merged = {}
        for entry in raw_entries:
            product_id = entry.get('product_id')
            if product_id is None:
                product_id = (entry.get('product') or {}).get('id')
            try:
                product_id = int(product_id)
                quantity = int(entry.get('quantity') or 0)
            except (TypeError, ValueError):
                continue
            if product_id <= 0 or quantity <= 0:
                continue
            merged[product_id] = merged.get(product_id, 0) + quantity
        return merged

    @staticmethod
    def _create_order_items(order, merged_items):
        """Lock rows in a stable order, verify stock and write the order lines.

        Must be called inside ``transaction.atomic()``. Locking products in
        ascending id order prevents deadlocks between concurrent checkouts
        that reference the same products in a different order.
        """
        products = {
            product.id: product
            for product in (
                Product.objects.select_for_update()
                .filter(id__in=merged_items.keys())
                .order_by('id')
            )
        }

        missing = sorted(set(merged_items) - set(products))
        if missing:
            raise StockError('One or more products in your cart are no longer available.')

        subtotal = Decimal('0')
        for product_id in sorted(merged_items):
            product = products[product_id]
            quantity = merged_items[product_id]

            if quantity > product.quantity:
                raise StockError(
                    f'Not enough stock for {product.name}. '
                    f'Available: {product.quantity}, Requested: {quantity}'
                )

            unit_price = product.discounted_price
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                unit_price=unit_price,
            )
            subtotal += unit_price * quantity

            product.quantity -= quantity
            product.in_stock = product.quantity > 0
            product.save(update_fields=['quantity', 'in_stock', 'updated_at'])

        return subtotal

    @staticmethod
    def _idempotency_key(request):
        """Read the client's ``Idempotency-Key`` header.

        Returns ``''`` when the header is absent (the request is then processed
        without replay protection) and raises a 400 when it is malformed, so a
        broken client cannot silently lose the guarantee.
        """
        raw = (request.headers.get(IDEMPOTENCY_HEADER) or '').strip()
        if not raw:
            return ''
        if not IDEMPOTENCY_KEY_PATTERN.match(raw):
            raise ParseError(
                f'{IDEMPOTENCY_HEADER} must be 8-64 characters of letters, '
                'digits, "-", "_", "." or ":".'
            )
        return raw

    @staticmethod
    def _find_existing(user, idempotency_key):
        """The order already created for this user + key, if any."""
        return (
            Order.objects.filter(user=user, idempotency_key=idempotency_key)
            .select_related('shipping_info')
            .prefetch_related('items__product')
            .first()
        )

    def post(self, request):
        serializer = PlaceOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        idempotency_key = self._idempotency_key(request)
        if idempotency_key:
            replayed = self._find_existing(request.user, idempotency_key)
            if replayed is not None:
                # The same checkout attempt arriving twice (double click, retry
                # after a timeout) returns the order that already exists instead
                # of placing a second one.
                return Response(
                    OrderSerializer(replayed, context={'request': request}).data,
                    status=status.HTTP_200_OK,
                )

        merged_items = self._merge_items(data.get('items') or [])

        if not merged_items:
            return Response(
                {'error': 'Your cart is empty. Please add items before checkout.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # COD abuse protection: one account may only hold a limited number of
        # orders that are still awaiting fulfilment. The replay check above runs
        # first so a retry of an existing order is never blocked by this cap.
        max_open_orders = getattr(settings, 'MAX_OPEN_ORDERS', 1)
        if max_open_orders > 0:
            open_orders = Order.objects.filter(
                user=request.user, status__in=OPEN_STATUSES,
            ).count()
            if open_orders >= max_open_orders:
                return Response(
                    {
                        'error': 'You already have an order awaiting confirmation. '
                                 'Please wait until it is confirmed or cancelled before '
                                 'placing another one.'
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        try:
            # Everything below is one unit of work: if any step fails, the
            # shipping record, order, items and stock changes are all rolled back.
            with transaction.atomic():
                shipping = ShippingInfo.objects.create(**data['shipping_info'])
                order = Order.objects.create(
                    user=request.user,
                    shipping_info=shipping,
                    delivery_type=data['delivery_type'],
                    payment_method=data['payment_method'],
                    idempotency_key=idempotency_key or None,
                )
                subtotal = self._create_order_items(order, merged_items)

                order.delivery_charge = delivery_charge_for(order.delivery_type)
                order.total_amount = subtotal + order.delivery_charge
                order.save(update_fields=['delivery_charge', 'total_amount', 'updated_at'])
        except IntegrityError:
            # Two identical requests raced: the unique constraint on
            # (user, idempotency_key) let exactly one of them win. Return that
            # winner so the loser still gets a successful, idempotent answer.
            replayed = (
                self._find_existing(request.user, idempotency_key)
                if idempotency_key else None
            )
            if replayed is not None:
                return Response(
                    OrderSerializer(replayed, context={'request': request}).data,
                    status=status.HTTP_200_OK,
                )
            logger.exception(
                'Order placement hit an unexpected integrity error for user_id=%s',
                request.user.pk,
            )
            return Response(
                {'error': 'Order placement failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except StockError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            # Never leak internal details to the client; log the full trace.
            logger.exception('Order placement failed for user_id=%s', request.user.pk)
            return Response(
                {'error': 'Order placement failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            OrderSerializer(order, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class DeliveryOptionsView(APIView):
    """Authoritative delivery fees, so the storefront never hard-codes them."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'inside': str(delivery_charge_for(DeliveryType.INSIDE)),
            'outside': str(delivery_charge_for(DeliveryType.OUTSIDE)),
        })


class OrderListView(generics.ListAPIView):
    serializer_class   = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .select_related('shipping_info')
            .prefetch_related('items__product')
        )

    def paginate_queryset(self, queryset):
        page = super().paginate_queryset(queryset)
        self._page = page
        return page

    def get_serializer_context(self):
        """Resolve "already reviewed" ids for the whole page in ONE query.

        Without this the serializer would run a ProductReview query per order
        on the page (an N+1 on order history).
        """
        context = super().get_serializer_context()
        page = getattr(self, '_page', None)
        if page is not None:
            from apps.catalog.models import ProductReview

            product_ids = {item.product_id for order in page for item in order.items.all()}
            context['reviewed_product_ids'] = set(
                ProductReview.objects.filter(
                    user=self.request.user, product_id__in=product_ids,
                ).values_list('product_id', flat=True)
            )
        return context


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class   = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (
            Order.objects.filter(user=self.request.user)
            .select_related('shipping_info')
            .prefetch_related('items__product')
        )
