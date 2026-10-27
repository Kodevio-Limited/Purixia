from decimal import Decimal

from django.db.models import Avg
from rest_framework import serializers
from .models import (
    Category, Product, ProductFeature, ProductImage, ProductReview,
    ProductSpecification, Subcategory,
)
from apps.orders.models import OrderItem, OrderStatus


class SubcategorySerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)

    class Meta:
        model = Subcategory
        fields = ('id', 'category', 'category_name', 'category_slug', 'name', 'slug', 'image')


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ('id', 'image')


class ProductFeatureSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductFeature
        fields = ('id', 'text', 'order')


class ProductSpecificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductSpecification
        fields = ('id', 'name', 'value', 'order')


class ProductReviewSerializer(serializers.ModelSerializer):
    is_verified_purchase = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProductReview
        fields = (
            'id', 'reviewer_name', 'rating', 'title', 'comment',
            'is_verified_purchase', 'created_at',
        )


def refresh_product_rating(product: Product) -> None:
    """Recompute Product.rating from real reviews (0.0 when there are none)."""
    avg = product.reviews.aggregate(v=Avg('rating'))['v']
    product.rating = Decimal(str(round(avg, 1))) if avg is not None else Decimal('0.0')
    product.save(update_fields=['rating', 'updated_at'])


class ProductReviewCreateSerializer(serializers.ModelSerializer):
    """Serializer for a logged-in user submitting a review from their order page."""

    class Meta:
        model = ProductReview
        fields = ('rating', 'title', 'comment')

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        product = self.context.get('product')
        user = getattr(request, 'user', None)

        if user is None or not user.is_authenticated:
            raise serializers.ValidationError({'detail': 'Authentication required.'})

        # Reviews are allowed only for products from a delivered order.
        if product is not None and not OrderItem.objects.filter(
            order__user=user,
            product=product,
            order__status=OrderStatus.DELIVERED,
        ).exists():
            raise serializers.ValidationError(
                {'detail': 'You can review this product once your order is delivered.'}
            )

        if not (attrs.get('comment') or '').strip() and not (attrs.get('title') or '').strip():
            raise serializers.ValidationError(
                {'comment': 'Please write a comment or a title for your review.'}
            )
        return attrs

    def create(self, validated_data):
        request = self.context['request']
        user = request.user
        product = self.context['product']

        if ProductReview.objects.filter(product=product, user=user).exists():
            raise serializers.ValidationError(
                {'detail': 'You have already reviewed this product.'}
            )

        has_purchased = OrderItem.objects.filter(
            order__user=user,
            product=product,
            order__status=OrderStatus.DELIVERED,
        ).exists()

        review = ProductReview.objects.create(
            product=product,
            user=user,
            reviewer_name=(user.get_full_name() or user.username or user.email)[:200],
            is_verified_purchase=has_purchased,
            **validated_data,
        )
        refresh_product_rating(product)
        return review


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True)
    subcategory_slug = serializers.CharField(source='subcategory.slug', read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    features = ProductFeatureSerializer(many=True, read_only=True)
    specifications = ProductSpecificationSerializer(many=True, read_only=True)
    reviews = ProductReviewSerializer(many=True, read_only=True)
    # Declared as a DecimalField so it always serializes as a fixed-precision
    # string (matching `price`) instead of a JSON float.
    discounted_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model  = Product
        fields = (
            'id', 'category', 'category_name', 'category_slug',
            'subcategory', 'subcategory_name', 'subcategory_slug',
            'name', 'title', 'description',
            'price', 'discount_percent', 'discounted_price',
            'quantity', 'rating', 'in_stock', 'image',
            'images', 'features', 'specifications', 'reviews',
            'created_at', 'updated_at',
        )
        read_only_fields = ('in_stock', 'created_at', 'updated_at')

    def validate(self, attrs):
        category = attrs.get('category') or getattr(self.instance, 'category', None)
        subcategory = attrs.get('subcategory') or getattr(self.instance, 'subcategory', None)
        if subcategory and category and subcategory.category_id != category.id:
            raise serializers.ValidationError({
                'subcategory': f"'{subcategory.name}' does not belong to category '{category.name}'."
            })
        if subcategory and not category:
            attrs['category'] = subcategory.category
        return attrs


class ProductListSerializer(serializers.ModelSerializer):
    """Lightweight product payload for list/grid views.

    Omits the deep nested collections (features, specifications, reviews) that
    only the detail page needs. This keeps list responses small and avoids the
    N+1 query storm a full serializer would cause on the catalog page.
    """

    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    subcategory_name = serializers.CharField(source='subcategory.name', read_only=True)
    subcategory_slug = serializers.CharField(source='subcategory.slug', read_only=True)
    images = ProductImageSerializer(many=True, read_only=True)
    discounted_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    review_count = serializers.SerializerMethodField()

    class Meta:
        model  = Product
        fields = (
            'id', 'category', 'category_name', 'category_slug',
            'subcategory', 'subcategory_name', 'subcategory_slug',
            'name', 'title', 'price', 'discount_percent',
            'discounted_price', 'quantity', 'rating', 'in_stock', 'image',
            'images', 'review_count', 'created_at', 'updated_at',
        )
        read_only_fields = ('in_stock', 'created_at', 'updated_at')

    def get_review_count(self, obj):
        annotated = getattr(obj, 'review_count', None)
        if annotated is not None:
            return annotated
        # Falls back to the prefetched reviews when the view did not annotate.
        return len(obj.reviews.all())


class CategorySerializer(serializers.ModelSerializer):
    subcategories = SubcategorySerializer(many=True, read_only=True)
    products = ProductSerializer(many=True, read_only=True)

    class Meta:
        model  = Category
        fields = ('id', 'name', 'slug', 'image', 'subcategories', 'products')


class CategoryListSerializer(serializers.ModelSerializer):
    subcategories = SubcategorySerializer(many=True, read_only=True)

    class Meta:
        model  = Category
        fields = ('id', 'name', 'slug', 'image', 'subcategories')
