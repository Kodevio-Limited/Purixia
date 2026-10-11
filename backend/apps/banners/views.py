from rest_framework import viewsets, permissions
from .models import Banner
from .serializers import BannerSerializer


class BannerViewSet(viewsets.ModelViewSet):
    queryset         = Banner.objects.filter(is_active=True)
    serializer_class = BannerSerializer

    def get_queryset(self):
        # Only active banners are public; staff must still be able to edit or
        # delete a banner they have switched off.
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return Banner.objects.all()
        return Banner.objects.filter(is_active=True)

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]