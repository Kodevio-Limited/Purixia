from django.urls import path
from .views import (
    DeliveryOptionsView, OrderDetailView, OrderListView, PlaceOrderView,
)

urlpatterns = [
    path('',                   OrderListView.as_view(),      name='order-list'),
    path('place/',             PlaceOrderView.as_view(),     name='order-place'),
    path('delivery-options/',  DeliveryOptionsView.as_view(), name='order-delivery-options'),
    path('<int:pk>/',          OrderDetailView.as_view(),    name='order-detail'),
]
