from django.contrib.admin.sites import AdminSite
from rest_framework.test import APITestCase
from unittest.mock import Mock

from apps.banners.admin import BannerAdmin
from apps.banners.models import Banner
from apps.users.models import User

PASSWORD = 'Sup3rSecret!23'


class BannerActiveTests(APITestCase):
    def setUp(self):
        self.staff_user = User.objects.create_superuser(username='banneradmin', email='banneradmin@example.com', password=PASSWORD)
        self.active_banner = Banner.objects.create(title='Active Banner', is_active=True, order=1)
        self.inactive_banner = Banner.objects.create(title='Inactive Banner', is_active=False, order=2)

    def test_public_user_only_sees_active_banners(self):
        res = self.client.get('/api/banners/')
        self.assertEqual(res.status_code, 200)
        titles = [b['title'] for b in res.data]
        self.assertIn('Active Banner', titles)
        self.assertNotIn('Inactive Banner', titles)

    def test_staff_user_defaults_to_active_and_can_opt_in(self):
        self.client.force_authenticate(self.staff_user)
        # Default without params: only active banners
        res = self.client.get('/api/banners/')
        self.assertEqual(res.status_code, 200)
        titles = [b['title'] for b in res.data]
        self.assertIn('Active Banner', titles)
        self.assertNotIn('Inactive Banner', titles)

        # Explicitly opt-in with include_inactive=true
        res = self.client.get('/api/banners/?include_inactive=true')
        self.assertEqual(res.status_code, 200)
        titles = [b['title'] for b in res.data]
        self.assertIn('Active Banner', titles)
        self.assertIn('Inactive Banner', titles)

    def test_banner_admin_actions(self):
        site = AdminSite()
        admin = BannerAdmin(Banner, site)
        request = Mock()

        admin.mark_as_inactive(request, Banner.objects.filter(id=self.active_banner.id))
        self.active_banner.refresh_from_db()
        self.assertFalse(self.active_banner.is_active)

        admin.mark_as_active(request, Banner.objects.filter(id=self.active_banner.id))
        self.active_banner.refresh_from_db()
        self.assertTrue(self.active_banner.is_active)

    def test_banner_admin_one_click_toggle(self):
        self.client.force_login(self.staff_user)
        toggle_url = f'/admin/banners/banner/{self.active_banner.id}/toggle-active/'
        res = self.client.get(toggle_url)
        self.assertEqual(res.status_code, 302)
        self.active_banner.refresh_from_db()
        self.assertFalse(self.active_banner.is_active)

        # Toggle back to active
        res = self.client.get(toggle_url)
        self.assertEqual(res.status_code, 302)
        self.active_banner.refresh_from_db()
        self.assertTrue(self.active_banner.is_active)
