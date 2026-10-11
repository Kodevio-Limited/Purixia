from decimal import Decimal
from unittest import mock

from django.contrib.admin.sites import AdminSite
from django.contrib.sessions.models import Session
from django.core.cache import cache
from django.db import connection
from django.test import RequestFactory, TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient, APITestCase
from rest_framework.throttling import ScopedRateThrottle

from apps.catalog.models import Category, Product
from apps.orders.admin import OrderAdmin, OrderAdminForm
from apps.orders.models import (
    ALLOWED_STATUS_TRANSITIONS, InvalidStatusTransition, Order, OrderItem,
    OrderStatus, ShippingInfo,
)
from apps.users.models import User

PASSWORD = 'Sup3rSecret!23'


def make_order_payload(items, delivery_type='inside', payment_method='cod'):
    return {
        'shipping_info': {
            'name': 'Test Buyer',
            'email': 'buyer@example.com',
            'phone': '01712345678',
            'address': 'House 1, Road 2, Dhaka',
        },
        'delivery_type': delivery_type,
        'payment_method': payment_method,
        'items': items,
    }


class PlaceOrderTests(APITestCase):
    url = '/api/orders/place/'

    def setUp(self):
        self.user = User.objects.create_user(
            username='buyer', email='buyer@example.com', password=PASSWORD,
        )
        self.client.force_authenticate(self.user)
        self.category = Category.objects.create(name='Watches', slug='watches')
        # price 1000 with a 10% offer => discounted selling price 900.
        self.product = Product.objects.create(
            category=self.category, name='Smart Watch', title='Smart Watch',
            price=Decimal('1000.00'), discount_percent=10, quantity=5,
        )

    def test_server_prices_the_line_item_ignoring_client_price(self):
        res = self.client.post(self.url, make_order_payload([
            {'product_id': self.product.id, 'quantity': 2, 'price': '1.00'},
        ]), format='json')

        self.assertEqual(res.status_code, 201, res.data)
        order = Order.objects.get()
        item = order.items.get()
        self.assertEqual(item.unit_price, Decimal('900.00'))       # not 1.00
        self.assertEqual(order.delivery_charge, Decimal('60.00'))
        self.assertEqual(order.total_amount, Decimal('1860.00'))   # 1800 + 60
        self.assertEqual(res.data['subtotal'], '1800.00')

    def test_outside_dhaka_grand_total_uses_higher_fee(self):
        res = self.client.post(self.url, make_order_payload(
            [{'product_id': self.product.id, 'quantity': 1}], delivery_type='outside',
        ), format='json')

        self.assertEqual(res.status_code, 201, res.data)
        order = Order.objects.get()
        self.assertEqual(order.delivery_charge, Decimal('120.00'))
        self.assertEqual(order.total_amount, Decimal('1020.00'))   # 900 + 120

    def test_insufficient_stock_rolls_back_the_whole_order(self):
        res = self.client.post(self.url, make_order_payload([
            {'product_id': self.product.id, 'quantity': 10},
        ]), format='json')

        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(Order.objects.count(), 0)
        self.assertEqual(OrderItem.objects.count(), 0)
        self.assertEqual(ShippingInfo.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 5)

    def test_failure_on_later_line_rolls_back_earlier_lines(self):
        sold_out = Product.objects.create(
            category=self.category, name='Sold Out', title='Sold Out',
            price=Decimal('500.00'), quantity=0,
        )
        res = self.client.post(self.url, make_order_payload([
            {'product_id': self.product.id, 'quantity': 1},   # would succeed
            {'product_id': sold_out.id, 'quantity': 1},       # fails
        ]), format='json')

        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(OrderItem.objects.count(), 0)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 5)            # not decremented

    def test_stock_is_decremented_and_flagged_out_of_stock(self):
        res = self.client.post(self.url, make_order_payload([
            {'product_id': self.product.id, 'quantity': 5},
        ]), format='json')

        self.assertEqual(res.status_code, 201, res.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 0)
        self.assertFalse(self.product.in_stock)

    def test_duplicate_product_lines_are_merged(self):
        res = self.client.post(self.url, make_order_payload([
            {'product_id': self.product.id, 'quantity': 1},
            {'product_id': self.product.id, 'quantity': 1},
        ]), format='json')

        self.assertEqual(res.status_code, 201, res.data)
        order = Order.objects.get()
        self.assertEqual(order.items.count(), 1)
        self.assertEqual(order.items.get().quantity, 2)

    def test_empty_payload_is_rejected(self):
        payload = make_order_payload([])
        res = self.client.post(self.url, payload, format='json')
        self.assertEqual(res.status_code, 400)

    def test_checkout_never_creates_an_anonymous_session_row(self):
        """The server-side session cart is gone: placing an order is stateless.

        Session rows are per-replica state and used to be created for every
        anonymous cart request, so this guards the removal.
        """
        self.assertEqual(Session.objects.count(), 0)

        # A successful order is placed from the request body alone.
        res = self.client.post(self.url, make_order_payload([
            {'product_id': self.product.id, 'quantity': 1},
        ]), format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Session.objects.count(), 0)

        # A rejected one too: no session is written on the failure path.
        rejected = self.client.post(self.url, make_order_payload([]), format='json')
        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(Session.objects.count(), 0)

    def test_removed_cart_endpoints_are_unrouted(self):
        for method, path in (
            ('get', '/api/cart/'),
            ('delete', '/api/cart/clear/'),
        ):
            with self.subTest(path=path):
                response = getattr(self.client, method)(path)
                self.assertEqual(response.status_code, 404)

    def test_order_requires_authentication(self):
        res = APIClient().post(self.url, make_order_payload([
            {'product_id': self.product.id, 'quantity': 1},
        ]), format='json')
        self.assertIn(res.status_code, (401, 403))

    def test_history_only_returns_own_orders(self):
        self.client.post(self.url, make_order_payload([
            {'product_id': self.product.id, 'quantity': 1},
        ]), format='json')

        other = User.objects.create_user(username='other', email='other@example.com', password=PASSWORD)
        self.client.force_authenticate(other)
        res = self.client.get('/api/orders/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 0)


class OrderHistoryQueryTests(APITestCase):
    def test_order_history_query_count_is_bounded(self):
        """Order history must not run a review lookup per order."""
        user = User.objects.create_user(username='hist', email='hist@example.com', password=PASSWORD)
        self.client.force_authenticate(user)
        category = Category.objects.create(name='C2', slug='c2')
        product = Product.objects.create(
            category=category, name='History Product', title='History Product',
            price=Decimal('100.00'), quantity=100,
        )
        for _ in range(10):
            shipping = ShippingInfo.objects.create(
                name='Buyer', email='h@example.com', phone='01712345678', address='Dhaka',
            )
            order = Order.objects.create(user=user, shipping_info=shipping)
            OrderItem.objects.create(order=order, product=product, quantity=1, unit_price=Decimal('100.00'))

        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get('/api/orders/')

        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 10)
        self.assertLessEqual(len(ctx.captured_queries), 8, [q['sql'] for q in ctx.captured_queries])


class DeliveryOptionsTests(TestCase):
    def test_delivery_options_are_public_and_authoritative(self):
        res = APIClient().get('/api/orders/delivery-options/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {'inside': '60', 'outside': '120'})


# ── Phase 3: order integrity ──────────────────────────────────────────────────
# A shared fixture: one buyer, one product with 5 in stock, 10% discount.
class OrderIntegrityCase(APITestCase):
    url = '/api/orders/place/'
    key = 'attempt-0001-abcdef'

    def setUp(self):
        cache.clear()  # throttling state lives in the cache
        self.user = User.objects.create_user(
            username='buyer', email='buyer@example.com', password=PASSWORD,
        )
        self.client.force_authenticate(self.user)
        self.category = Category.objects.create(name='Watches', slug='watches')
        self.product = Product.objects.create(
            category=self.category, name='Smart Watch', title='Smart Watch',
            price=Decimal('1000.00'), discount_percent=10, quantity=5,
        )

    def place(self, items=None, key=key, shipping_info=None, **overrides):
        payload = make_order_payload(
            [{'product_id': self.product.id, 'quantity': 1}] if items is None else items,
            **overrides,
        )
        if shipping_info is not None:
            payload['shipping_info'] = shipping_info
        headers = {'HTTP_IDEMPOTENCY_KEY': key} if key else {}
        return self.client.post(self.url, payload, format='json', **headers)


class IdempotencyTests(OrderIntegrityCase):
    def test_same_key_returns_the_same_order_instead_of_a_second_one(self):
        first = self.place()
        self.assertEqual(first.status_code, 201, first.data)

        replay = self.place()
        self.assertEqual(replay.status_code, 200, replay.data)
        self.assertEqual(replay.data['id'], first.data['id'])
        self.assertEqual(Order.objects.count(), 1)

        # Stock was decremented exactly once, not twice.
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 4)

    def test_the_key_is_stored_on_the_order(self):
        self.place()
        self.assertEqual(Order.objects.get().idempotency_key, self.key)

    def test_different_key_is_a_different_order(self):
        first = self.place()
        self.assertEqual(first.status_code, 201, first.data)

        # The open-order cap allows one unpaid order, so this is refused...
        second = self.place(key='attempt-0002-abcdef')
        self.assertEqual(second.status_code, 409, second.data)
        self.assertEqual(Order.objects.count(), 1)

        # ...but once the first order leaves the open state it is accepted, and
        # it is a genuinely new order rather than a replay of the first.
        order = Order.objects.get()
        order.transition_to(OrderStatus.CONFIRMED)
        order.transition_to(OrderStatus.SHIPPED)
        third = self.place(key='attempt-0002-abcdef')
        self.assertEqual(third.status_code, 201, third.data)
        self.assertEqual(Order.objects.count(), 2)
        self.assertNotEqual(third.data['id'], first.data['id'])

    def test_a_malformed_key_is_rejected_rather_than_ignored(self):
        res = self.place(key='short')
        self.assertEqual(res.status_code, 400, res.data)
        self.assertEqual(Order.objects.count(), 0)

    def test_no_key_still_places_an_order(self):
        res = self.place(key='')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertIsNone(Order.objects.get().idempotency_key)

    def test_keys_are_scoped_per_user(self):
        self.assertEqual(self.place().status_code, 201)

        other = User.objects.create_user(
            username='other', email='other@example.com', password=PASSWORD,
        )
        self.client.force_authenticate(other)
        # Same key value, different account: it must create THEIR order, not
        # leak the first customer's order.
        res = self.place()
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Order.objects.filter(user=other).count(), 1)
        self.assertEqual(Order.objects.filter(user=self.user).count(), 1)


class OpenOrderCapTests(OrderIntegrityCase):
    def test_second_open_order_is_refused(self):
        self.assertEqual(self.place(key='').status_code, 201)
        res = self.place(key='')
        self.assertEqual(res.status_code, 409, res.data)
        self.assertIn('awaiting confirmation', res.data['error'])
        self.assertEqual(Order.objects.count(), 1)

    def test_a_confirmed_but_undelivered_order_still_counts_as_open(self):
        self.place(key='')
        order = Order.objects.get()
        order.transition_to(OrderStatus.CONFIRMED)
        self.assertEqual(self.place(key='').status_code, 409)

    def test_shipped_order_frees_the_slot(self):
        self.place(key='')
        order = Order.objects.get()
        order.transition_to(OrderStatus.CONFIRMED)
        order.transition_to(OrderStatus.SHIPPED)
        self.assertEqual(self.place(key='').status_code, 201)

    def test_cancelled_order_frees_the_slot(self):
        self.place(key='')
        Order.objects.get().transition_to(OrderStatus.CANCELLED)
        self.assertEqual(self.place(key='').status_code, 201)

    @override_settings(MAX_OPEN_ORDERS=2)
    def test_cap_is_configurable(self):
        self.assertEqual(self.place(key='').status_code, 201)
        self.assertEqual(self.place(key='').status_code, 201)
        self.assertEqual(self.place(key='').status_code, 409)


class OrderPlacementThrottleTests(OrderIntegrityCase):
    def test_order_scope_is_configured_and_wired_to_the_view(self):
        from django.conf import settings

        from apps.orders.views import PlaceOrderView

        self.assertIn('order', settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'])
        self.assertEqual(PlaceOrderView.throttle_scope, 'order')

    def test_placement_is_rate_limited_per_user(self):
        # The real rate (10/hour) is a policy, not something to wait for in a
        # test, so the same code path is exercised with a tiny budget.
        with mock.patch.dict(ScopedRateThrottle.THROTTLE_RATES, {'order': '3/hour'}):
            statuses = [self.place(key='').status_code for _ in range(3)]
            throttled = self.place(key='').status_code

        # Whatever the first three answered (201, then 409 from the open-order
        # cap), the fourth must be refused by the throttle itself.
        self.assertNotIn(429, statuses)
        self.assertEqual(throttled, 429)


class ShippingValidationTests(OrderIntegrityCase):
    def shipping(self, **overrides):
        payload = {
            'name': 'Test Buyer', 'email': 'buyer@example.com',
            'phone': '01712345678', 'address': 'House 1, Road 2, Dhaka',
        }
        payload.update(overrides)
        return payload

    def assert_shipping_error(self, response, field):
        """shipping_info is a nested serializer, so errors nest with it."""
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn(field, response.data.get('shipping_info', {}))

    def test_separators_are_stripped_and_stored_canonically(self):
        res = self.place(key='', shipping_info=self.shipping(phone='01712-345678'))
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(Order.objects.get().shipping_info.phone, '01712345678')

    def test_country_code_form_is_accepted_and_canonicalised(self):
        for typed in ('+8801712345678', '8801712345678'):
            with self.subTest(typed=typed):
                Order.objects.all().delete()
                res = self.place(key='', shipping_info=self.shipping(phone=typed))
                self.assertEqual(res.status_code, 201, res.data)
                self.assertEqual(Order.objects.get().shipping_info.phone, '01712345678')

    def test_unreachable_phone_numbers_are_rejected(self):
        for bad in ('12345', '0171234567', '017123456789', '02712345678',
                    'not-a-phone', '0171234567a'):
            with self.subTest(phone=bad):
                res = self.place(key='', shipping_info=self.shipping(phone=bad))
                self.assert_shipping_error(res, 'phone')
                self.assertEqual(Order.objects.count(), 0)

    def test_address_must_be_a_real_address(self):
        for bad in ('Dhaka', '   ', '1234567890', 'x' * 501):
            with self.subTest(address=bad):
                res = self.place(key='', shipping_info=self.shipping(address=bad))
                self.assert_shipping_error(res, 'address')

    def test_address_whitespace_is_collapsed(self):
        res = self.place(key='', shipping_info=self.shipping(address='  House 1,   Road 2,   Dhaka  '))
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(
            Order.objects.get().shipping_info.address, 'House 1, Road 2, Dhaka',
        )

    def test_name_must_be_present(self):
        res = self.place(key='', shipping_info=self.shipping(name=' A '))
        self.assert_shipping_error(res, 'name')


class StatusTransitionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='status', email='status@example.com', password=PASSWORD,
        )
        self.category = Category.objects.create(name='Gadgets', slug='gadgets')
        self.product = Product.objects.create(
            category=self.category, name='Earbuds', title='Earbuds',
            price=Decimal('500.00'), quantity=0,
        )
        shipping = ShippingInfo.objects.create(
            name='Buyer', email='buyer@example.com', phone='01712345678', address='Dhaka',
        )
        self.order = Order.objects.create(user=self.user, shipping_info=shipping)
        OrderItem.objects.create(
            order=self.order, product=self.product, quantity=2, unit_price=Decimal('500.00'),
        )

    def test_the_happy_path_is_allowed(self):
        for status_value in (OrderStatus.CONFIRMED, OrderStatus.SHIPPED, OrderStatus.DELIVERED):
            with self.subTest(status=status_value):
                self.order.transition_to(status_value)
                self.order.refresh_from_db()
                self.assertEqual(self.order.status, status_value)

    def test_skipping_a_step_is_refused(self):
        with self.assertRaises(InvalidStatusTransition):
            self.order.transition_to(OrderStatus.DELIVERED)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.PENDING)

    def test_moving_backwards_is_refused(self):
        self.order.transition_to(OrderStatus.CONFIRMED)
        with self.assertRaises(InvalidStatusTransition):
            self.order.transition_to(OrderStatus.PENDING)

    def test_delivered_orders_can_never_be_cancelled(self):
        self.order.transition_to(OrderStatus.CONFIRMED)
        self.order.transition_to(OrderStatus.SHIPPED)
        self.order.transition_to(OrderStatus.DELIVERED)
        with self.assertRaises(InvalidStatusTransition):
            self.order.transition_to(OrderStatus.CANCELLED)

    def test_cancelling_restores_the_stock_it_reserved(self):
        self.order.transition_to(OrderStatus.CANCELLED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 2)
        self.assertTrue(self.product.in_stock)

    def test_cancelling_from_shipped_also_restores_stock(self):
        self.order.transition_to(OrderStatus.CONFIRMED)
        self.order.transition_to(OrderStatus.SHIPPED)
        self.order.transition_to(OrderStatus.CANCELLED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 2)

    def test_cancelling_twice_does_not_restore_stock_twice(self):
        self.order.transition_to(OrderStatus.CANCELLED)
        # Same instance, already cancelled: a no-op, never another stock return.
        self.order.transition_to(OrderStatus.CANCELLED)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 2)   # not 4

    def test_a_stale_cancel_is_refused_instead_of_restoring_stock_again(self):
        stale = Order.objects.get(pk=self.order.pk)
        self.order.transition_to(OrderStatus.CANCELLED)

        # `stale` still believes the order is pending (as a second admin's page
        # would). The row lock re-read must catch that and refuse.
        stale.status = OrderStatus.PENDING
        with self.assertRaises(InvalidStatusTransition):
            stale.transition_to(OrderStatus.CANCELLED)

        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 2)

    def test_re_applying_the_current_status_is_a_no_op(self):
        self.order.transition_to(OrderStatus.PENDING)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity, 0)

    def test_open_orders_are_pending_and_confirmed_only(self):
        self.assertTrue(self.order.is_open)
        self.order.transition_to(OrderStatus.CONFIRMED)
        self.assertTrue(self.order.is_open)
        self.order.transition_to(OrderStatus.SHIPPED)
        self.assertFalse(self.order.is_open)

    def test_every_status_is_described_by_the_transition_table(self):
        for status_value in OrderStatus.values:
            self.assertIn(status_value, ALLOWED_STATUS_TRANSITIONS)


class OrderAdminTransitionTests(TestCase):
    """The admin is the merchant's tool, so it must not bypass the rules."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='admin', email='admin@example.com', password=PASSWORD,
        )
        self.staff = User.objects.create_superuser(
            username='root', email='root@example.com', password=PASSWORD,
        )
        category = Category.objects.create(name='Admin', slug='admin')
        self.product = Product.objects.create(
            category=category, name='Item', title='Item',
            price=Decimal('100.00'), quantity=0,
        )
        self.shipping = ShippingInfo.objects.create(
            name='Buyer', email='buyer@example.com', phone='01712345678', address='Dhaka',
        )
        self.order = Order.objects.create(user=self.user, shipping_info=self.shipping)
        OrderItem.objects.create(
            order=self.order, product=self.product, quantity=3, unit_price=Decimal('100.00'),
        )
        self.admin = OrderAdmin(Order, AdminSite())
        self.request = RequestFactory().post('/admin/orders/order/')
        self.request.user = self.staff

    def form_data(self, status_value):
        return {
            'user': self.user.pk,
            'shipping_info': self.shipping.pk,
            'delivery_type': 'inside',
            'payment_method': 'cod',
            'status': status_value,
            'total_amount': '300.00',
            # The admin's fieldsets own the real field list; this only satisfies
            # the standalone ModelForm used here.
            'delivery_charge': '60.00',
        }

    def test_change_form_refuses_an_illegal_jump(self):
        form = OrderAdminForm(instance=self.order, data=self.form_data('delivered'))
        self.assertFalse(form.is_valid())
        self.assertIn('status', form.errors)

    def test_change_form_allows_a_legal_move(self):
        form = OrderAdminForm(instance=self.order, data=self.form_data('confirmed'))
        self.assertTrue(form.is_valid(), form.errors)

    def test_bulk_cancel_restores_stock(self):
        with mock.patch.object(self.admin, 'message_user') as message:
            self.admin.mark_cancelled(self.request, Order.objects.filter(pk=self.order.pk))

        self.order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.CANCELLED)
        self.assertEqual(self.product.quantity, 3)
        self.assertIn('marked as cancelled', message.call_args[0][1])

    def test_bulk_action_reports_orders_it_had_to_skip(self):
        Order.objects.filter(pk=self.order.pk).update(status=OrderStatus.DELIVERED)
        with mock.patch.object(self.admin, 'message_user') as message:
            self.admin.mark_cancelled(self.request, Order.objects.filter(pk=self.order.pk))

        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.DELIVERED)  # untouched
        self.assertIn('skipped', message.call_args[0][1])
