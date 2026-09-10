from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from .models import Category, Product
from .serializers import (
    CategoryListSerializer, CategorySerializer, ProductReviewCreateSerializer,
    ProductSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset     = Category.objects.all()
    lookup_field = 'slug'

    def get_serializer_class(self):
        return CategoryListSerializer if self.action == 'list' else CategorySerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [AllowAny()]


class ProductViewSet(viewsets.ModelViewSet):
    queryset         = Product.objects.select_related('category').all()
    serializer_class = ProductSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        if self.action == 'create_review':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get_queryset(self):
        qs       = super().get_queryset()
        category = self.request.query_params.get('category')
        in_stock = self.request.query_params.get('in_stock')
        if category:
            qs = qs.filter(category__slug=category)
        if in_stock is not None:
            qs = qs.filter(in_stock=in_stock.lower() == 'true')
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