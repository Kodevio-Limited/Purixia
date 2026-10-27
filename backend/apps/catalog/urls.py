from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ProductViewSet, SubcategoryViewSet

router = DefaultRouter()
router.register('categories',    CategoryViewSet,    basename='category')
router.register('subcategories', SubcategoryViewSet, basename='subcategory')
router.register('products',      ProductViewSet,     basename='product')

urlpatterns = [path('', include(router.urls))]