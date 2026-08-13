from django.contrib import admin
from django.utils.html import format_html
from .models import Banner


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ('title', 'image_preview', 'order', 'status_badge', 'created_at')
    list_filter = ('is_active',)
    list_editable = ('order',)
    search_fields = ('title',)
    readonly_fields = ('created_at',)

    fieldsets = (
        ('Banner Content', {
            'fields': ('title', 'image', 'link_url')
        }),
        ('Settings', {
            'fields': ('order', 'is_active')
        }),
        ('Timestamps', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="max-height: 50px; border-radius: 8px;" />', obj.image.url)
        return format_html('<span style="color: #999;">No image</span>')
    image_preview.short_description = 'Preview'

    def status_badge(self, obj):
        if obj.is_active:
            return format_html('<span class="badge badge-success">Active</span>')
        return format_html('<span class="badge badge-secondary">Inactive</span>')
    status_badge.short_description = 'Status'
    status_badge.admin_order_field = 'is_active'
