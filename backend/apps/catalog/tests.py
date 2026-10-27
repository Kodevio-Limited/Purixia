from decimal import Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from apps.catalog.models import (
    Category, Product, ProductFeature, ProductImage, ProductReview, ProductSpecification, Subcategory,
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


class SubcategoryTests(APITestCase):
    def setUp(self):
        self.category = Category.objects.create(name='Electronics', slug='electronics')
        self.category2 = Category.objects.create(name='Fashion', slug='fashion')
        self.subcat1 = Subcategory.objects.create(category=self.category, name='Smartphones', slug='smartphones')
        self.subcat2 = Subcategory.objects.create(category=self.category, name='Laptops', slug='laptops')
        self.subcat3 = Subcategory.objects.create(category=self.category2, name='Shoes', slug='shoes')

        self.p1 = Product.objects.create(
            category=self.category, subcategory=self.subcat1,
            name='iPhone 15', title='Apple Phone', price=Decimal('999.00'), quantity=10,
        )
        self.p2 = Product.objects.create(
            category=self.category, subcategory=self.subcat2,
            name='MacBook Pro', title='Apple Laptop', price=Decimal('1999.00'), quantity=5,
        )

    def test_list_subcategories_returns_all(self):
        res = self.client.get('/api/catalog/subcategories/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 3)

    def test_filter_subcategories_by_category_slug(self):
        res = self.client.get('/api/catalog/subcategories/?category=electronics')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 2)
        slugs = [s['slug'] for s in res.data]
        self.assertIn('smartphones', slugs)
        self.assertIn('laptops', slugs)
        self.assertNotIn('shoes', slugs)

    def test_category_list_includes_subcategories(self):
        res = self.client.get('/api/catalog/categories/')
        self.assertEqual(res.status_code, 200)
        electronics = next(c for c in res.data if c['slug'] == 'electronics')
        self.assertEqual(len(electronics['subcategories']), 2)
        sub_names = [s['name'] for s in electronics['subcategories']]
        self.assertIn('Smartphones', sub_names)
        self.assertIn('Laptops', sub_names)

    def test_product_list_includes_subcategory_and_category_names(self):
        res = self.client.get('/api/catalog/products/')
        self.assertEqual(res.status_code, 200)
        item = next(p for p in res.data['results'] if p['id'] == self.p1.id)
        self.assertEqual(item['category'], self.category.id)
        self.assertEqual(item['category_name'], 'Electronics')
        self.assertEqual(item['category_slug'], 'electronics')
        self.assertEqual(item['subcategory'], self.subcat1.id)
        self.assertEqual(item['subcategory_name'], 'Smartphones')
        self.assertEqual(item['subcategory_slug'], 'smartphones')

    def test_filter_products_by_subcategory(self):
        res = self.client.get('/api/catalog/products/?subcategory=smartphones')
        self.assertEqual(res.status_code, 200)
        names = [p['name'] for p in res.data['results']]
        self.assertIn('iPhone 15', names)
        self.assertNotIn('MacBook Pro', names)

    def test_product_validation_rejects_mismatched_subcategory(self):
        from rest_framework.exceptions import ValidationError
        from apps.catalog.serializers import ProductSerializer

        serializer = ProductSerializer(data={
            'category': self.category.id,
            'subcategory': self.subcat3.id,  # subcat3 belongs to Fashion, not Electronics
            'name': 'Invalid Prod',
            'title': 'Test',
            'price': '100.00',
            'quantity': 1,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('subcategory', serializer.errors)

