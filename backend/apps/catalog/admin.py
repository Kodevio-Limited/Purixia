from django.contrib import admin
from django.utils.html import format_html
from .models import Category, Product, ProductFeature, ProductImage, ProductReview, ProductSpecification


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
    list_display = ('name', 'slug', 'product_count')
    prepopulated_fields = {'slug': ('name',)}
    search_fields = ('name',)

    def product_count(self, obj):
        count = obj.products.count()
        return format_html('<span class="badge badge-warning">{}</span>', count)
    product_count.short_description = 'Products'


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price_display', 'stock_badge', 'rating_stars', 'status_badge')
    list_filter = ('category', 'in_stock', 'created_at')
    search_fields = ('name', 'title', 'description')
    list_editable = ()
    readonly_fields = ('created_at', 'updated_at')
    inlines = [ProductImageInline, ProductFeatureInline, ProductSpecificationInline, ProductReviewInline]
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'title', 'category', 'description')
        }),
        ('Pricing & Stock', {
            'fields': ('price', 'discount_percent', 'quantity', 'in_stock'),
            'description': 'Offer % set here drives the sale price shown on the site (0 = no offer).',
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

    def status_badge(self, obj):
        if obj.in_stock:
            return format_html('<span class="badge badge-success">Active</span>')
        return format_html('<span class="badge badge-secondary">Inactive</span>')
    status_badge.short_description = 'Status'
    status_badge.admin_order_field = 'in_stock'
