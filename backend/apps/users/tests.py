from decimal import Decimal

from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Product
from apps.users.models import User
from apps.users.tokens import email_verification_token, encode_uid

PASSWORD = 'Sup3rSecret!23'


class RegisterTests(APITestCase):
    url = '/api/auth/register/'

    def test_register_without_username_generates_one(self):
        res = self.client.post(
            self.url,
            {'email': 'shopper@example.com', 'phone': '01712345678', 'password': PASSWORD},
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['user']['username'])
        # The access token is returned; the refresh token travels only in the
        # HttpOnly cookie, never in the body.
        self.assertIn('access', res.data['tokens'])
        self.assertNotIn('refresh', res.data['tokens'])
        self.assertTrue(res.cookies['purixia_refresh'].value)

    def test_register_rejects_duplicate_email_case_insensitively(self):
        User.objects.create_user(username='taken', email='shopper@example.com', password=PASSWORD)
        res = self.client.post(
            self.url,
            {'email': 'Shopper@Example.com', 'password': PASSWORD},
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('email', res.data)

    def test_register_rejects_weak_password(self):
        res = self.client.post(self.url, {'email': 'weak@example.com', 'password': '123'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('password', res.data)

    def test_register_requires_email(self):
        res = self.client.post(self.url, {'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('email', res.data)

    def test_register_rejects_duplicate_username(self):
        User.objects.create_user(username='alice', email='alice@example.com', password=PASSWORD)
        res = self.client.post(
            self.url,
            {'email': 'alice2@example.com', 'username': 'alice', 'password': PASSWORD},
            format='json',
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn('username', res.data)


class LoginTests(APITestCase):
    url = '/api/auth/login/'

    def test_login_after_registration(self):
        self.client.post(
            '/api/auth/register/',
            {'email': 'login@example.com', 'password': PASSWORD},
            format='json',
        )
        res = self.client.post(self.url, {'email': 'login@example.com', 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn('access', res.data['tokens'])

    def test_login_is_case_insensitive_on_email(self):
        User.objects.create_user(username='ci', email='case@example.com', password=PASSWORD)
        res = self.client.post(self.url, {'email': 'CASE@example.com', 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, 200, res.data)

    def test_login_with_duplicate_emails_does_not_500(self):
        # Legacy rows may share an email; login must not raise MultipleObjectsReturned.
        User.objects.create_user(username='dup1', email='dup@example.com', password=PASSWORD)
        User.objects.create_user(username='dup2', email='dup@example.com', password=PASSWORD)
        res = self.client.post(self.url, {'email': 'dup@example.com', 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, 200, res.data)

    def test_login_with_wrong_password_is_rejected(self):
        User.objects.create_user(username='wrong', email='wrong@example.com', password=PASSWORD)
        res = self.client.post(self.url, {'email': 'wrong@example.com', 'password': 'nope1234'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_disabled_account_is_rejected(self):
        user = User.objects.create_user(username='off', email='off@example.com', password=PASSWORD)
        user.is_active = False
        user.save(update_fields=['is_active'])
        res = self.client.post(self.url, {'email': 'off@example.com', 'password': PASSWORD}, format='json')
        self.assertEqual(res.status_code, 400)


class LogoutTests(APITestCase):
    def test_logout_without_refresh_token_returns_400(self):
        user = User.objects.create_user(username='lo', email='lo@example.com', password=PASSWORD)
        self.client.force_authenticate(user)
        res = self.client.post('/api/auth/logout/', {}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_logout_blacklists_cookie_token_and_clears_cookie(self):
        User.objects.create_user(username='bye', email='bye@example.com', password=PASSWORD)
        login = self.client.post(
            '/api/auth/login/',
            {'email': 'bye@example.com', 'password': PASSWORD},
            format='json',
        )
        old_refresh = login.cookies['purixia_refresh'].value
        access = login.data['tokens']['access']
        res = self.client.post(
            '/api/auth/logout/',
            HTTP_AUTHORIZATION=f'Bearer {access}',
        )
        self.assertEqual(res.status_code, 205, res.data)
        # The cookie is expired (empty value, max-age 0)...
        cleared = res.cookies['purixia_refresh']
        self.assertEqual(cleared.value, '')
        self.assertEqual(str(cleared['max-age']), '0')
        # ...and the pre-logout refresh token is blacklisted: reuse fails.
        replay = self.client.post(
            '/api/auth/token/refresh/', {'refresh': old_refresh}, format='json',
        )
        self.assertEqual(replay.status_code, 401)


class RefreshCookieTests(APITestCase):
    url = '/api/auth/token/refresh/'

    def _login(self, email='ck@example.com', username='ck'):
        User.objects.create_user(username=username, email=email, password=PASSWORD)
        res = self.client.post(
            '/api/auth/login/', {'email': email, 'password': PASSWORD}, format='json',
        )
        self.assertEqual(res.status_code, 200, res.data)
        return res

    def test_login_sets_httponly_scoped_cookie(self):
        res = self._login()
        cookie = res.cookies['purixia_refresh']
        self.assertTrue(cookie.value)
        self.assertTrue(cookie['httponly'])
        # Narrowest path covering refresh+logout: never on catalog/order calls.
        self.assertEqual(cookie['path'], '/api/auth/')
        # HttpOnly cookie in test settings is not Secure; prod forces Secure.
        self.assertFalse(cookie['secure'])

    @override_settings(REFRESH_COOKIE_SECURE=True)
    def test_secure_flag_follows_settings(self):
        res = self._login(email='sec@example.com', username='sec')
        self.assertTrue(res.cookies['purixia_refresh']['secure'])

    def test_refresh_uses_cookie_and_rotates_it(self):
        login = self._login()
        old_refresh = login.cookies['purixia_refresh'].value
        # The test client keeps the login cookie, like a browser would.
        res = self.client.post(self.url, {}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn('access', res.data)
        self.assertNotIn('refresh', res.data)
        rotated = res.cookies['purixia_refresh'].value
        self.assertTrue(rotated)
        self.assertNotEqual(rotated, old_refresh)
        # Rotation blacklists the old cookie token: a replay must fail.
        self.client.cookies['purixia_refresh'] = old_refresh
        replay = self.client.post(self.url, {}, format='json')
        self.assertEqual(replay.status_code, 401)

    def test_refresh_without_cookie_or_body_is_rejected(self):
        res = self.client.post(self.url, {}, format='json')
        self.assertEqual(res.status_code, 400)


class HealthTests(APITestCase):
    def test_health_endpoint_reports_ok(self):
        res = self.client.get('/api/health/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['status'], 'ok')


class PasswordResetTests(APITestCase):
    request_url = '/api/auth/password/reset/'
    confirm_url = '/api/auth/password/reset/confirm/'
    NEW_PASSWORD = 'N3wSecret!45'

    def _link(self, user):
        # The exact payload the emailed link carries (uid + token from the
        # email helpers' URL), as the frontend posts it back.
        return {
            'uid': encode_uid(user),
            'token': default_token_generator.make_token(user),
            'new_password': self.NEW_PASSWORD,
        }

    def test_request_returns_same_answer_for_unknown_email(self):
        res = self.client.post(self.request_url, {'email': 'ghost@example.com'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertIn('message', res.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_request_emails_existing_user(self):
        User.objects.create_user(username='pr', email='pr@example.com', password=PASSWORD)
        res = self.client.post(self.request_url, {'email': 'pr@example.com'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('pr@example.com', mail.outbox[0].to)
        self.assertIn('reset-password?uid=', mail.outbox[0].body)

    def test_confirm_resets_password(self):
        user = User.objects.create_user(username='pc', email='pc@example.com', password=PASSWORD)
        res = self.client.post(self.confirm_url, self._link(user), format='json')
        self.assertEqual(res.status_code, 200, res.data)
        old_login = self.client.post(
            '/api/auth/login/', {'email': 'pc@example.com', 'password': PASSWORD}, format='json',
        )
        self.assertEqual(old_login.status_code, 400)
        new_login = self.client.post(
            '/api/auth/login/', {'email': 'pc@example.com', 'password': self.NEW_PASSWORD},
            format='json',
        )
        self.assertEqual(new_login.status_code, 200, new_login.data)

    def test_confirm_link_is_single_use(self):
        user = User.objects.create_user(username='once', email='once@example.com', password=PASSWORD)
        payload = self._link(user)
        first = self.client.post(self.confirm_url, payload, format='json')
        self.assertEqual(first.status_code, 200, first.data)
        # Same link again: the password change killed the token.
        second = self.client.post(self.confirm_url, payload, format='json')
        self.assertEqual(second.status_code, 400)

    def test_confirm_rejects_tampered_token(self):
        user = User.objects.create_user(username='tamper', email='tamper@example.com', password=PASSWORD)
        res = self.client.post(
            self.confirm_url,
            {'uid': encode_uid(user), 'token': 'not-a-real-token', 'new_password': self.NEW_PASSWORD},
            format='json',
        )
        self.assertEqual(res.status_code, 400)


class EmailVerificationTests(APITestCase):
    url = '/api/auth/verify-email/'

    def _link(self, user):
        return {
            'uid': encode_uid(user),
            'token': email_verification_token.make_token(user),
        }

    def test_signup_sends_verification_email(self):
        res = self.client.post(
            '/api/auth/register/',
            {'email': 'v@example.com', 'password': PASSWORD},
            format='json',
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertFalse(res.data['user']['email_verified'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('v@example.com', mail.outbox[0].to)
        self.assertIn('verify-email?uid=', mail.outbox[0].body)

    def test_verify_link_sets_email_verified(self):
        user = User.objects.create_user(username='ev', email='ev@example.com', password=PASSWORD)
        res = self.client.post(self.url, self._link(user), format='json')
        self.assertEqual(res.status_code, 200, res.data)
        user.refresh_from_db()
        self.assertTrue(user.email_verified)

    def test_verify_link_cannot_be_replayed(self):
        user = User.objects.create_user(username='ev2', email='ev2@example.com', password=PASSWORD)
        payload = self._link(user)
        first = self.client.post(self.url, payload, format='json')
        self.assertEqual(first.status_code, 200, first.data)
        # Confirming flipped email_verified, which the token is bound to.
        second = self.client.post(self.url, payload, format='json')
        self.assertEqual(second.status_code, 400)

    def test_unverified_user_can_login_and_order(self):
        """The "send link, never blocks" policy: ordering never waits for an
        inbox. An unverified account logs in and places a COD order normally.
        """
        user = User.objects.create_user(username='shop', email='shop@example.com', password=PASSWORD)
        self.assertFalse(user.email_verified)
        login = self.client.post(
            '/api/auth/login/', {'email': 'shop@example.com', 'password': PASSWORD}, format='json',
        )
        self.assertEqual(login.status_code, 200, login.data)
        self.client.force_authenticate(user)
        category = Category.objects.create(name='Phones', slug='phones')
        product = Product.objects.create(
            category=category, name='Phone', title='Phone',
            price=Decimal('1000.00'), discount_percent=0, quantity=5,
        )
        res = self.client.post('/api/orders/place/', {
            'shipping_info': {
                'name': 'Test Buyer', 'email': 'shop@example.com',
                'phone': '01712345678', 'address': 'House 1, Road 2, Dhaka',
            },
            'delivery_type': 'inside',
            'payment_method': 'cod',
            'items': [{'product_id': product.id, 'quantity': 1}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
