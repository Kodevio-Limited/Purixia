from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.generic import RedirectView
from django.views.static import serve

from core.views import health, liveness

urlpatterns = [
    # Load-balancer / orchestrator probes (no auth, cheap).
    # Readiness checks dependencies (DB + cache); liveness checks only the process.
    path('api/health/', health, name='health'),
    path('api/health/live/', liveness, name='health-live'),
    # Bare root (e.g. admin.purixiabd.com) redirects straight into the admin panel
    path('', RedirectView.as_view(url='/admin/', permanent=False)),
    path('admin/', admin.site.urls),
    path('api/auth/',    include('apps.users.urls')),
    path('api/catalog/', include('apps.catalog.urls')),
    path('api/orders/',  include('apps.orders.urls')),
    path('api/banners/', include('apps.banners.urls')),
]

# User uploads are served from the shared media volume. Static files are served
# by WhiteNoise middleware in production (and by the dev server in DEBUG), so we
# only expose media here instead of shadowing WhiteNoise with a static route.
urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT})]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
