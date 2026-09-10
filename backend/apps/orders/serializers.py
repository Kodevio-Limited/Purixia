from rest_framework import serializers
from .models import Order, OrderItem, ShippingInfo


class ShippingInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ShippingInfo
        fields = ('name', 'email', 'phone', 'address')


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    subtotal     = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model  = OrderItem
        fields = ('id', 'product', 'product_name', 'quantity', 'unit_price', 'subtotal')


class OrderSerializer(serializers.ModelSerializer):
    items         = OrderItemSerializer(many=True, read_only=True)
    shipping_info = ShippingInfoSerializer(read_only=True)
    # Products in this order the current user has already reviewed.
    # Lets the user panel show "Reviewed" instead of "Write a Review".
    reviewed_product_ids = serializers.SerializerMethodField()

    class Meta:
        model  = Order
        fields = (
            'id', 'user', 'shipping_info', 'delivery_type',
            'payment_method', 'status', 'total_amount', 'items',
            'reviewed_product_ids', 'created_at',
        )
        read_only_fields = ('user', 'status', 'total_amount', 'created_at')

    def get_reviewed_product_ids(self, obj):
        from apps.catalog.models import ProductReview
        request = self.context.get('request')
        if request is None or not getattr(request, 'user', None) or not request.user.is_authenticated:
            return []
        product_ids = [item.product_id for item in obj.items.all()]
        if not product_ids:
            return []
        reviewed = ProductReview.objects.filter(
            user=request.user, product_id__in=product_ids
        ).values_list('product_id', flat=True)
        return list(reviewed)


class CartItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity   = serializers.IntegerField(min_value=1)
    price      = serializers.DecimalField(max_digits=12, decimal_places=2)

class PlaceOrderSerializer(serializers.Serializer):
    shipping_info  = ShippingInfoSerializer()
    delivery_type  = serializers.ChoiceField(choices=['inside', 'outside'], default='inside')
    payment_method = serializers.ChoiceField(choices=['cod', 'card', 'bkash', 'nagad'], default='cod')
    items          = CartItemSerializer(many=True, required=False)