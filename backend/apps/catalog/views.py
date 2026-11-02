from django.db import transaction
from django.db.models import Count
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import Category, Product, Subcategory
from .serializers import (
    CategoryListSerializer, CategorySerializer, ProductListSerializer,
    ProductReviewCreateSerializer, ProductSerializer, SubcategorySerializer,
)


class SubcategoryViewSet(viewsets.ModelViewSet):
    queryset         = Subcategory.objects.select_related('category').all()
    serializer_class = SubcategorySerializer
    lookup_field     = 'slug'
    pagination_class = None

    def get_queryset(self):
        qs = super().get_queryset()
        is_staff = bool(self.request.user and self.request.user.is_staff)
        include_inactive = self.request.query_params.get('include_inactive') == 'true'

        if not (is_staff and include_inactive):
            qs = qs.filter(category__is_active=True)

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category__slug=category)
        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [AllowAny()]


class CategoryViewSet(viewsets.ModelViewSet):
    queryset         = Category.objects.all()
    lookup_field     = 'slug'
    pagination_class = None  # Categories are a small lookup list; return all of them unpaginated

    def get_serializer_class(self):
        return CategoryListSerializer if self.action == 'list' else CategorySerializer

    def get_queryset(self):
        qs = super().get_queryset().prefetch_related('subcategories')
        is_staff = bool(self.request.user and self.request.user.is_staff)
        include_inactive = self.request.query_params.get('include_inactive') == 'true'
        is_active_param = self.request.query_params.get('is_active')

        if is_staff and include_inactive:
            pass
        elif is_staff and is_active_param is not None:
            if is_active_param.lower() != 'all':
                qs = qs.filter(is_active=is_active_param.lower() == 'true')
        else:
            qs = qs.filter(is_active=True)

        if self.action == 'retrieve':
            # Category detail embeds full products; prefetch everything the
            # nested ProductSerializer touches so it doesn't fire per-product
            # queries (features, specifications, reviews, gallery images).
            qs = qs.prefetch_related(
                'products__images',
                'products__features',
                'products__specifications',
                'products__reviews',
            )
        return qs

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [AllowAny()]


class ProductViewSet(viewsets.ModelViewSet):
    queryset         = Product.objects.select_related('category', 'subcategory').all()
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        if self.action == 'create_review':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_serializer_class(self):
        # Grid/list views get a compact payload; detail (and writes) get everything.
        if self.action == 'list':
            return ProductListSerializer
        return ProductSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        if self.action == 'list':
            # Single aggregate query for review counts + one for gallery images,
            # instead of per-product COUNT/query per row. The explicit order_by
            # matters: annotate() adds GROUP BY, which disables Meta.ordering and
            # would otherwise make pagination results unstable.
            qs = (
                qs.annotate(review_count=Count('reviews'))
                .prefetch_related('images')
                .order_by('-created_at', '-id')
            )
        elif self.action == 'retrieve':
            qs = qs.prefetch_related(
                'images', 'features', 'specifications', 'reviews',
            )

        is_staff = bool(self.request.user and self.request.user.is_staff)
        include_inactive = self.request.query_params.get('include_inactive') == 'true'
        is_active_param = self.request.query_params.get('is_active')

        if is_staff and include_inactive:
            pass  # Staff explicitly requested to include inactive products
        elif is_staff and is_active_param is not None:
            if is_active_param.lower() != 'all':
                qs = qs.filter(is_active=is_active_param.lower() == 'true')
        else:
            # Default for all storefront queries (customers and staff browsing):
            qs = qs.filter(is_active=True, category__is_active=True)

        category = self.request.query_params.get('category')
        subcategory = self.request.query_params.get('subcategory')
        in_stock = self.request.query_params.get('in_stock')
        offered  = self.request.query_params.get('offered')
        if category:
            qs = qs.filter(category__slug=category)
        if subcategory:
            qs = qs.filter(subcategory__slug=subcategory)
        if in_stock is not None:
            qs = qs.filter(in_stock=in_stock.lower() == 'true')
        if offered is not None and offered.lower() == 'true':
            qs = qs.filter(discount_percent__gt=0)
        return qs

    @action(detail=True, methods=['post'], url_path='reviews', permission_classes=[IsAuthenticated])
    def create_review(self, request, pk=None):
        """Logged-in user submits a review for this product (from their order page)."""
        product = self.get_object()

        serializer = ProductReviewCreateSerializer(
            data=request.data,
            context={'request': request, 'product': product},
        )
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            review = serializer.save()
        return Response(
            {
                'id': review.id,
                'product': product.id,
                'reviewer_name': review.reviewer_name,
                'rating': review.rating,
                'title': review.title,
                'comment': review.comment,
                'is_verified_purchase': review.is_verified_purchase,
                'created_at': review.created_at,
            },
            status=status.HTTP_201_CREATED,
        )
