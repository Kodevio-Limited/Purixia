from django.contrib import admin
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseRedirect
from django.urls import path, reverse
from django.utils.html import format_html
from .models import Category, Product, ProductFeature, ProductImage, ProductReview, ProductSpecification, Subcategory


class SubcategoryInline(admin.TabularInline):
    model = Subcategory
    extra = 1
    prepopulated_fields = {'slug': ('name',)}
    fields = ('name', 'slug', 'image')


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 1
    fields = ('image', 'image_preview')
    readonly_fields = ('image_preview',)

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="max-height: 60px; border-radius: 6px;" />', obj.image.url)
        return ''
    image_preview.short_description = 'Preview'


class ProductFeatureInline(admin.TabularInline):
    model = ProductFeature
    extra = 1
    fields = ('text', 'order')


class ProductSpecificationInline(admin.TabularInline):
    model = ProductSpecification
    extra = 1
    fields = ('name', 'value', 'order')


class ProductReviewInline(admin.TabularInline):
    model = ProductReview
    extra = 1
    fields = ('reviewer_name', 'rating', 'title', 'comment')


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'subcategory_count', 'product_count', 'status_badge')
    list_filter = ('is_active',)
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    fields = ('name', 'slug', 'image', 'is_active')
    actions = ['mark_as_active', 'mark_as_inactive']
    inlines = [SubcategoryInline]

    def subcategory_count(self, obj):
        count = obj.subcategories.count()
        return format_html('<span class="badge badge-info">{}</span>', count)
    subcategory_count.short_description = 'Subcategories'

    def product_count(self, obj):
        count = obj.products.count()
        return format_html('<span class="badge badge-warning">{}</span>', count)
    product_count.short_description = 'Products'

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<path:object_id>/toggle-active/',
                self.admin_site.admin_view(self.toggle_active),
                name='catalog_category_toggle_active',
            ),
        ]
        return custom_urls + urls

    def toggle_active(self, request, object_id):
        if not self.has_change_permission(request):
            raise PermissionDenied
        obj = self.get_object(request, object_id)
        if obj is not None:
            obj.is_active = not obj.is_active
            obj.save(update_fields=['is_active'])
            status_text = 'Active' if obj.is_active else 'Inactive'
            self.message_user(request, f'Category "{obj.name}" is now {status_text}.')
        return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('admin:catalog_category_changelist'))

    def status_badge(self, obj):
        toggle_url = reverse('admin:catalog_category_toggle_active', args=[obj.pk])
        if obj.is_active:
            return format_html(
                '<a href="{}" class="btn btn-xs btn-success" style="border-radius: 12px; padding: 2px 10px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Click to set Inactive">'
                '<i class="fas fa-toggle-on"></i> Active'
                '</a>',
                toggle_url,
            )
        return format_html(
            '<a href="{}" class="btn btn-xs btn-secondary" style="border-radius: 12px; padding: 2px 10px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Click to set Active">'
            '<i class="fas fa-toggle-off"></i> Inactive'
            '</a>',
            toggle_url,
        )
    status_badge.short_description = 'Status (Click to toggle)'
    status_badge.admin_order_field = 'is_active'

    def mark_as_active(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count} category(ies) marked as active.')
    mark_as_active.short_description = 'Mark selected categories as Active'

    def mark_as_inactive(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count} category(ies) marked as inactive.')
    mark_as_inactive.short_description = 'Mark selected categories as Inactive'


@admin.register(Subcategory)
class SubcategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'slug', 'product_count')
    list_filter = ('category',)
    search_fields = ('name', 'category__name')
    prepopulated_fields = {'slug': ('name',)}

    def product_count(self, obj):
        count = obj.products.count()
        return format_html('<span class="badge badge-warning">{}</span>', count)
    product_count.short_description = 'Products'


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'subcategory', 'price_display', 'stock_badge', 'rating_stars', 'status_badge')
    list_filter = ('is_active', 'category', 'subcategory', 'in_stock', 'created_at')
    search_fields = ('name', 'title', 'description')
    list_editable = ()
    readonly_fields = ('in_stock', 'created_at', 'updated_at')
    actions = ['mark_as_active', 'mark_as_inactive']
    inlines = [ProductImageInline, ProductFeatureInline, ProductSpecificationInline, ProductReviewInline]
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'title', 'category', 'subcategory', 'description', 'is_active')
        }),
        ('Pricing & Stock', {
            'fields': ('price', 'discount_percent', 'quantity', 'in_stock'),
            'description': 'Offer % set here drives the sale price shown on the site (0 = no offer). In-stock is automatically derived from quantity.',
        }),
        ('Media', {
            'fields': ('image',)
        }),
        ('Ratings', {
            'fields': ('rating',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def price_display(self, obj):
        return format_html('<strong>৳ {}</strong>', obj.price)
    price_display.short_description = 'Price'
    price_display.admin_order_field = 'price'

    def stock_badge(self, obj):
        if obj.quantity <= 0:
            return format_html('<span class="badge badge-danger">Out of Stock</span>')
        elif obj.quantity <= 5:
            return format_html('<span class="badge badge-warning">Low ({})</span>', obj.quantity)
        return format_html('<span class="badge badge-success">{} in stock</span>', obj.quantity)
    stock_badge.short_description = 'Stock'
    stock_badge.admin_order_field = 'quantity'

    def rating_stars(self, obj):
        full = int(float(obj.rating))
        empty = 5 - full
        stars = '★' * full + '☆' * empty
        return format_html('<span style="color: #F4B227;">{}</span>', stars)
    rating_stars.short_description = 'Rating'

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<path:object_id>/toggle-active/',
                self.admin_site.admin_view(self.toggle_active),
                name='catalog_product_toggle_active',
            ),
        ]
        return custom_urls + urls

    def toggle_active(self, request, object_id):
        if not self.has_change_permission(request):
            raise PermissionDenied
        obj = self.get_object(request, object_id)
        if obj is not None:
            obj.is_active = not obj.is_active
            obj.save(update_fields=['is_active'])
            status_text = 'Active' if obj.is_active else 'Inactive'
            self.message_user(request, f'Product "{obj.name}" is now {status_text}.')
        return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('admin:catalog_product_changelist'))

    def status_badge(self, obj):
        toggle_url = reverse('admin:catalog_product_toggle_active', args=[obj.pk])
        if obj.is_active:
            return format_html(
                '<a href="{}" class="btn btn-xs btn-success" style="border-radius: 12px; padding: 2px 10px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Click to set Inactive">'
                '<i class="fas fa-toggle-on"></i> Active'
                '</a>',
                toggle_url,
            )
        return format_html(
            '<a href="{}" class="btn btn-xs btn-secondary" style="border-radius: 12px; padding: 2px 10px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;" title="Click to set Active">'
            '<i class="fas fa-toggle-off"></i> Inactive'
            '</a>',
            toggle_url,
        )
    status_badge.short_description = 'Status (Click to toggle)'
    status_badge.admin_order_field = 'is_active'

    def mark_as_active(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f'{count} product(s) marked as active.')
    mark_as_active.short_description = 'Mark selected products as Active'

    def mark_as_inactive(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count} product(s) marked as inactive.')
    mark_as_inactive.short_description = 'Mark selected products as Inactive'
