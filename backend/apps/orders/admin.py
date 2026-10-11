from django import forms
from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils import timezone
from .models import (
    InvalidStatusTransition, Order, OrderItem, OrderStatus, ShippingInfo,
)


class OrderAdminForm(forms.ModelForm):
    """Refuses illegal status jumps and says why, instead of silently saving.

    The allowed moves themselves live on the model (``can_transition_to``); this
    only turns a refusal into a normal form error.
    """

    class Meta:
        model = Order
        fields = '__all__'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Remember what is stored: by the time clean_status() runs,
        # ``self.instance.status`` still holds the value from the database.
        self.stored_status = self.instance.status if self.instance.pk else None

    def clean_status(self):
        new_status = self.cleaned_data['status']
        if (
            self.stored_status is not None
            and new_status != self.stored_status
            and not self.instance.can_transition_to(new_status)
        ):
            raise forms.ValidationError(
                f'An order that is "{self.stored_status}" cannot be changed to '
                f'"{new_status}". Allowed next steps: '
                f'{self._allowed_label()}.'
            )
        return new_status

    def _allowed_label(self):
        from .models import ALLOWED_STATUS_TRANSITIONS

        allowed = ALLOWED_STATUS_TRANSITIONS.get(self.stored_status, set())
        if not allowed:
            return 'none (this status is final)'
        return ', '.join(sorted(allowed))


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('subtotal',)
    fields = ('product', 'quantity', 'unit_price', 'subtotal')


def get_status_badge(status):
    colors = {
        'pending': 'warning',
        'confirmed': 'info',
        'shipped': 'primary',
        'delivered': 'success',
        'cancelled': 'danger',
    }
    color = colors.get(status, 'secondary')
    return format_html('<span class="badge badge-{}" style="font-size: 12px; padding: 5px 10px;">{}</span>', color, status.title())


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    form = OrderAdminForm
    list_display = ('order_id', 'customer', 'status_badge', 'payment_info', 'delivery_info', 'amount_display', 'placed_at')
    list_filter = ('status', 'payment_method', 'delivery_type', 'created_at')
    search_fields = ('user__username', 'user__email', 'id')
    readonly_fields = ('total_amount', 'idempotency_key', 'created_at')
    inlines = [OrderItemInline]
    actions = ['mark_confirmed', 'mark_shipped', 'mark_delivered', 'mark_cancelled']
    date_hierarchy = 'created_at'

    fieldsets = (
        ('Order Info', {
            'fields': ('user', 'status', 'total_amount', 'idempotency_key')
        }),
        ('Delivery', {
            'fields': ('delivery_type', 'shipping_info')
        }),
        ('Payment', {
            'fields': ('payment_method',)
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )

    def order_id(self, obj):
        url = reverse('admin:orders_order_change', args=[obj.pk])
        return format_html('<a href="{}" style="font-weight: 600;">#ORD-{}</a>', url, obj.id)
    order_id.short_description = 'Order'

    def customer(self, obj):
        return format_html('{} <br/><small style="color: #666;">{}</small>', obj.user.username, obj.user.email)
    customer.short_description = 'Customer'
    customer.admin_order_field = 'user__username'

    def status_badge(self, obj):
        return get_status_badge(obj.status)
    status_badge.short_description = 'Status'
    status_badge.admin_order_field = 'status'

    def payment_info(self, obj):
        icons = {'cod': '💵', 'card': '💳', 'bkash': '📱', 'nagad': '📱'}
        icon = icons.get(obj.payment_method, '💳')
        return format_html('{} <span style="text-transform: capitalize;">{}</span>', icon, obj.get_payment_method_display())
    payment_info.short_description = 'Payment'

    def delivery_info(self, obj):
        return format_html('<span style="text-transform: capitalize;">{}</span>', obj.get_delivery_type_display())
    delivery_info.short_description = 'Delivery'

    def amount_display(self, obj):
        return format_html('<strong>৳ {}</strong>', obj.total_amount)
    amount_display.short_description = 'Total'
    amount_display.admin_order_field = 'total_amount'

    def placed_at(self, obj):
        delta = timezone.now() - obj.created_at
        if delta.days == 0:
            return format_html('<span style="color: #666;">Today, {}</span>', obj.created_at.strftime('%I:%M %p'))
        elif delta.days == 1:
            return 'Yesterday'
        return obj.created_at.strftime('%b %d, %Y')
    placed_at.short_description = 'Placed'
    placed_at.admin_order_field = 'created_at'

    def save_model(self, request, obj, form, change):
        stored_status = getattr(form, 'stored_status', None)
        if change and stored_status is not None and stored_status != obj.status:
            # Route the status change through the domain method so cancelling
            # restores stock, and an illegal jump is refused even if the form
            # was bypassed.
            Order.objects.get(pk=obj.pk).transition_to(obj.status)
        super().save_model(request, obj, form, change)

    # ── Bulk status actions ───────────────────────────────────────────────────
    # Each one goes through Order.transition_to() rather than a queryset.update()
    # so the allowed-transition rules apply and cancelling restores stock.
    def _transition_selected(self, request, queryset, new_status, label):
        moved = 0
        skipped = 0
        for order in queryset:
            try:
                order.transition_to(new_status)
            except InvalidStatusTransition:
                skipped += 1
            else:
                moved += 1

        message = f'{moved} order(s) marked as {label}.'
        if skipped:
            message += f' {skipped} skipped: that move is not allowed from their current status.'
        self.message_user(request, message)

    def mark_confirmed(self, request, queryset):
        self._transition_selected(request, queryset, OrderStatus.CONFIRMED, 'confirmed')
    mark_confirmed.short_description = 'Mark selected as Confirmed'

    def mark_shipped(self, request, queryset):
        self._transition_selected(request, queryset, OrderStatus.SHIPPED, 'shipped')
    mark_shipped.short_description = 'Mark selected as Shipped'

    def mark_delivered(self, request, queryset):
        self._transition_selected(request, queryset, OrderStatus.DELIVERED, 'delivered')
    mark_delivered.short_description = 'Mark selected as Delivered'

    def mark_cancelled(self, request, queryset):
        self._transition_selected(request, queryset, OrderStatus.CANCELLED, 'cancelled')
    mark_cancelled.short_description = 'Mark selected as Cancelled (restores stock)'


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ('product', 'order_link', 'quantity', 'unit_price', 'subtotal_display')
    list_select_related = ('product', 'order')

    def order_link(self, obj):
        url = reverse('admin:orders_order_change', args=[obj.order_id])
        return format_html('<a href="{}">#ORD-{}</a>', url, obj.order_id)
    order_link.short_description = 'Order'

    def subtotal_display(self, obj):
        return format_html('<strong>৳ {}</strong>', obj.subtotal)
    subtotal_display.short_description = 'Subtotal'
    subtotal_display.admin_order_field = 'subtotal'


@admin.register(ShippingInfo)
class ShippingInfoAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'phone', 'address_preview')
    search_fields = ('name', 'email', 'phone')

    def address_preview(self, obj):
        if len(obj.address) > 50:
            return obj.address[:50] + '...'
        return obj.address
    address_preview.short_description = 'Address'
