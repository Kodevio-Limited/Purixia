from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import RedirectView
from django.views.static import serve

urlpatterns = [
    # Bare root (e.g. admin.purixiabd.com) redirects straight into the admin panel
    path('', RedirectView.as_view(url='/admin/', permanent=False)),
    path('admin/', admin.site.urls),
    path('api/auth/',    include('apps.users.urls')),
    path('api/catalog/', include('apps.catalog.urls')),
    path('api/cart/',    include('apps.cart.urls')),
    path('api/orders/',  include('apps.orders.urls')),
    path('api/banners/', include('apps.banners.urls')),
]

# Serve media files in both development and production (via WhiteNoise or Django)
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
]