from rest_framework import viewsets, permissions
from .models import Banner
from .serializers import BannerSerializer


class BannerViewSet(viewsets.ModelViewSet):
    queryset         = Banner.objects.filter(is_active=True)
    serializer_class = BannerSerializer
    pagination_class = None

    def get_queryset(self):
        is_staff = bool(self.request.user and self.request.user.is_staff)
        include_inactive = self.request.query_params.get('include_inactive') == 'true'
        is_active_param = self.request.query_params.get('is_active')

        if is_staff and include_inactive:
            return Banner.objects.all()
        elif is_staff and is_active_param is not None:
            if is_active_param.lower() != 'all':
                return Banner.objects.filter(is_active=is_active_param.lower() == 'true')
            return Banner.objects.all()
        return Banner.objects.filter(is_active=True)

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]