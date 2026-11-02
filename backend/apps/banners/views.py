from rest_framework import viewsets, permissions
from .models import Banner
from .serializers import BannerSerializer


class BannerViewSet(viewsets.ModelViewSet):
    queryset         = Banner.objects.filter(is_active=True)
    serializer_class = BannerSerializer
    pagination_class = None

    def get_queryset(self):
        # Only active banners are public; staff can view all or filter by is_active
        if self.request.user and self.request.user.is_staff:
            is_active = self.request.query_params.get('is_active')
            if is_active is not None:
                return Banner.objects.filter(is_active=is_active.lower() == 'true')
            return Banner.objects.all()
        return Banner.objects.filter(is_active=True)

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]