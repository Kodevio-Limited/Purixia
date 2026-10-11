import re

from rest_framework import serializers
from .models import Order, OrderItem, ShippingInfo

# Bangladeshi mobile numbers, in either national (01XXXXXXXXX) or country-code
# (+8801XXXXXXXXX) form. Separators are stripped before matching.
BD_PHONE_PATTERN = re.compile(r'^(?:\+?880|0)1[3-9]\d{8}$')
PHONE_SEPARATORS = re.compile(r'[\s\-().]')


class ShippingInfoSerializer(serializers.ModelSerializer):
    """Delivery details for a COD order.

    Cash on delivery is only as good as the details we ship against, so the
    phone number and address are validated here (and normalised into a form the
    merchant can dial / hand to a courier) instead of being trusted as typed.
    """

    class Meta:
        model  = ShippingInfo
        fields = ('name', 'email', 'phone', 'address')

    def validate_name(self, value):
        value = (value or '').strip()
        if len(value) < 2:
            raise serializers.ValidationError('Enter the name of the person receiving the order.')
        return value

    def validate_phone(self, value):
        digits = PHONE_SEPARATORS.sub('', (value or '').strip())
        if not BD_PHONE_PATTERN.match(digits):
            raise serializers.ValidationError(
                'Enter a valid Bangladeshi mobile number, for example '
                '01712345678 or +8801712345678.'
            )
        # Store one canonical national form so the merchant always sees a
        # number they can dial, whatever the customer typed.
        return '0' + digits[-10:]

    def validate_address(self, value):
        # Collapse runs of whitespace: "House 1,  Road 2" -> "House 1, Road 2".
        value = ' '.join((value or '').split())
        if len(value) < 10:
            raise serializers.ValidationError(
                'Enter the full delivery address (house, road, area, district).'
            )
        if len(value) > 500:
            raise serializers.ValidationError('Address is too long (500 characters maximum).')
        if not any(character.isalpha() for character in value):
            raise serializers.ValidationError('Enter a valid delivery address.')
        return value


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    subtotal     = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model  = OrderItem
        fields = ('id', 'product', 'product_name', 'quantity', 'unit_price', 'subtotal')


class OrderSerializer(serializers.ModelSerializer):
    items         = OrderItemSerializer(many=True, read_only=True)
    shipping_info = ShippingInfoSerializer(read_only=True)
    # Items subtotal (excludes delivery). total_amount is the grand total.
    subtotal      = serializers.SerializerMethodField()
    # Products in this order the current user has already reviewed.
    # Lets the user panel show "Reviewed" instead of "Write a Review".
    reviewed_product_ids = serializers.SerializerMethodField()

    class Meta:
        model  = Order
        fields = (
            'id', 'user', 'shipping_info', 'delivery_type',
            'payment_method', 'status', 'subtotal', 'delivery_charge',
            'total_amount', 'items', 'reviewed_product_ids', 'created_at',
        )
        read_only_fields = ('user', 'status', 'subtotal', 'delivery_charge', 'total_amount', 'created_at')

    def get_subtotal(self, obj):
        return str(obj.items_subtotal)

    def get_reviewed_product_ids(self, obj):
        request = self.context.get('request')
        if request is None or not getattr(request, 'user', None) or not request.user.is_authenticated:
            return []

        product_ids = [item.product_id for item in obj.items.all()]
        if not product_ids:
            return []

        # The order list precomputes this set for the whole page; the order
        # detail view (single object) falls back to one query.
        precomputed = self.context.get('reviewed_product_ids')
        if precomputed is not None:
            return [pid for pid in product_ids if pid in precomputed]

        from apps.catalog.models import ProductReview
        reviewed = ProductReview.objects.filter(
            user=request.user, product_id__in=product_ids
        ).values_list('product_id', flat=True)
        return list(reviewed)


class CartItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity   = serializers.IntegerField(min_value=1)
    # Accepted for backward compatibility but ignored: the server always prices
    # line items from the catalog's discounted selling price.
    price      = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)


class PlaceOrderSerializer(serializers.Serializer):
    shipping_info  = ShippingInfoSerializer()
    delivery_type  = serializers.ChoiceField(choices=['inside', 'outside'], default='inside')
    payment_method = serializers.ChoiceField(choices=['cod', 'card', 'bkash', 'nagad'], default='cod')
    items          = CartItemSerializer(many=True, required=False)
