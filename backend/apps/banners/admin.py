from django.contrib import admin
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseRedirect
from django.urls import path, reverse
from django.utils.html import format_html
from .models import Banner


@admin.register(Banner)
class BannerAdmin(admin.ModelAdmin):
    list_display = ('title', 'image_preview', 'order', 'status_badge', 'created_at')
    list_filter = ('is_active',)
    list_editable = ('order',)
    search_fields = ('title',)
    readonly_fields = ('created_at',)
    actions = ['mark_as_active', 'mark_as_inactive']

    fieldsets = (
        ('Banner Content', {
            'fields': ('title', 'subtitle', 'image')
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

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<path:object_id>/toggle-active/',
                self.admin_site.admin_view(self.toggle_active),
                name='banners_banner_toggle_active',
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
            self.message_user(request, f'Banner "{obj}" is now {status_text}.')
        return HttpResponseRedirect(request.META.get('HTTP_REFERER') or reverse('admin:banners_banner_changelist'))

    def status_badge(self, obj):
        toggle_url = reverse('admin:banners_banner_toggle_active', args=[obj.pk])
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
        self.message_user(request, f'{count} banner(s) marked as active.')
    mark_as_active.short_description = 'Mark selected banners as Active'

    def mark_as_inactive(self, request, queryset):
        count = queryset.update(is_active=False)
        self.message_user(request, f'{count} banner(s) marked as inactive.')
    mark_as_inactive.short_description = 'Mark selected banners as Inactive'
