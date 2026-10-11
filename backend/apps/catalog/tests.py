from decimal import Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from apps.catalog.models import (
    Category, Product, ProductFeature, ProductImage, ProductReview, ProductSpecification,
)
from apps.orders.models import DeliveryType, Order, OrderItem, OrderStatus, ShippingInfo
from apps.users.models import User

PASSWORD = 'Sup3rSecret!23'


class ProductListTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name='Watches', slug='watches')
        for i in range(25):
            product = Product.objects.create(
                category=self.category,
                name=f'Watch {i}',
                title='Smart watch',
                price=Decimal('1000.00'),
                discount_percent=10,
                quantity=5,
            )
            ProductImage.objects.create(product=product, image='products/x.png')
            ProductFeature.objects.create(product=product, text='Feature')
            ProductSpecification.objects.create(product=product, name='Brand', value='Kospet')
            ProductReview.objects.create(product=product, reviewer_name='Someone', rating=5, comment='Nice')

    def test_list_query_count_is_bounded_not_per_product(self):
        # A per-product serializer would fire 4+ queries * 25 products. The
        # bounded assertion is what proves the N+1 is gone.
        with CaptureQueriesContext(connection) as ctx:
            res = self.client.get('/api/catalog/products/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 25)
        self.assertLessEqual(len(ctx.captured_queries), 6, [q['sql'] for q in ctx.captured_queries])

    def test_list_payload_is_lightweight_and_includes_review_count(self):
        res = self.client.get('/api/catalog/products/')
        item = res.data['results'][0]
        self.assertIn('review_count', item)
        self.assertEqual(item['review_count'], 1)
        self.assertEqual(item['discounted_price'], '900.00')
        self.assertNotIn('reviews', item)
        self.assertNotIn('specifications', item)

    def test_detail_payload_includes_nested_collections(self):
        product = Product.objects.first()
        res = self.client.get(f'/api/catalog/products/{product.id}/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('reviews', res.data)
        self.assertIn('specifications', res.data)
        self.assertEqual(res.data['discounted_price'], '900.00')

    def test_offered_filter_returns_only_discounted_products(self):
        Product.objects.create(
            category=self.category, name='No offer', title='t',
            price=Decimal('500.00'), discount_percent=0, quantity=1,
        )
        res = self.client.get('/api/catalog/products/?offered=true')
        self.assertEqual(res.status_code, 200)
        names = [p['name'] for p in res.data['results']]
        self.assertNotIn('No offer', names)


class ReviewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='rev', email='rev@example.com', password=PASSWORD)
        self.category = Category.objects.create(name='Audio', slug='audio')
        self.product = Product.objects.create(
            category=self.category, name='Headphones', title='Headphones',
            price=Decimal('2000.00'), quantity=3,
        )
        self.client.force_authenticate(self.user)
        self.url = f'/api/catalog/products/{self.product.id}/reviews/'

    def _deliver_order_for(self, product):
        shipping = ShippingInfo.objects.create(
            name='Buyer', email='b@example.com', phone='01712345678', address='Dhaka',
        )
        order = Order.objects.create(
            user=self.user, shipping_info=shipping,
            delivery_type=DeliveryType.INSIDE, status=OrderStatus.DELIVERED,
        )
        OrderItem.objects.create(order=order, product=product, quantity=1, unit_price=product.price)
        return order

    def test_review_requires_delivered_order(self):
        res = self.client.post(self.url, {'rating': 5, 'comment': 'Great'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_review_allowed_after_delivery_and_updates_rating(self):
        self._deliver_order_for(self.product)
        res = self.client.post(self.url, {'rating': 4, 'comment': 'Very good'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)

        self.product.refresh_from_db()
        self.assertEqual(self.product.rating, Decimal('4.0'))
        self.assertTrue(res.data['is_verified_purchase'])

    def test_second_review_for_same_product_is_rejected(self):
        self._deliver_order_for(self.product)
        self.client.post(self.url, {'rating': 4, 'comment': 'Good'}, format='json')
        res = self.client.post(self.url, {'rating': 5, 'comment': 'Again'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_review_requires_a_comment_or_title(self):
        self._deliver_order_for(self.product)
        res = self.client.post(self.url, {'rating': 5, 'comment': '   ', 'title': ''}, format='json')
        self.assertEqual(res.status_code, 400)
