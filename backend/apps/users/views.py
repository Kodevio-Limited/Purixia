from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefresh
from rest_framework_simplejwt.tokens import RefreshToken

from .cookies import (
    clear_refresh_cookie,
    refresh_token_from_cookie,
    set_refresh_cookie,
)
from .emails import send_email_verification_email, send_password_reset_email
from .models import User
from .serializers import (
    EmailVerificationSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
)


# No auth classes = no CSRF enforcement on these endpoints.
# The frontend uses JWT (Bearer tokens), not sessions.
NO_SESSION_AUTH = []


def _auth_response(user):
    """Login/signup response: access token in the body, refresh in the cookie.

    JavaScript keeps the access token in memory only; the refresh token is set
    as an HttpOnly cookie (see apps/users/cookies.py) and never appears in the
    body, so a script cannot exfiltrate it.
    """
    refresh = RefreshToken.for_user(user)
    response = Response(
        {
            'user': UserSerializer(user).data,
            'tokens': {'access': str(refresh.access_token)},
        },
    )
    return set_refresh_cookie(response, str(refresh))


class RegisterView(generics.CreateAPIView):
    queryset            = User.objects.all()
    serializer_class    = RegisterSerializer
    authentication_classes = NO_SESSION_AUTH
    permission_classes  = [permissions.AllowAny]
    throttle_classes    = [ScopedRateThrottle]
    throttle_scope      = 'auth'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # "Send link, never blocks": the address can be confirmed later, but
        # signup always succeeds even if the mail server is down.
        send_email_verification_email(user)
        response = _auth_response(user)
        response.status_code = status.HTTP_201_CREATED
        return response


class LoginView(APIView):
    authentication_classes = NO_SESSION_AUTH
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'auth'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        return _auth_response(user)


class LogoutView(APIView):
    """Blacklist the refresh token and expire the cookie.

    The token comes from the HttpOnly cookie (set on login/signup/refresh);
    a body token is accepted as a fallback for non-browser clients.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh = refresh_token_from_cookie(request) or request.data.get('refresh')
        if not refresh:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh)
            token.blacklist()
        except Exception:
            return Response(
                {
                    'error': 'Invalid or expired token.'
                },
                status=status.HTTP_400_BAD_REQUEST)
        response = Response({'message': 'Logged out.'}, status=status.HTTP_205_RESET_CONTENT)
        return clear_refresh_cookie(response)


class PasswordResetRequestView(APIView):
    """Email a single-use, expiring reset link — or pretend to.

    Always answers 200 with the same message, so the endpoint cannot be used
    to probe which email addresses have accounts. Sends at most
    THROTTLE_EMAIL_SEND hits per hour per client, because each hit costs a
    message and could be aimed at someone else's inbox. Mail failures are
    best-effort (apps/users/emails.py) and never change the answer.
    """
    authentication_classes = NO_SESSION_AUTH
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'email_send'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # filter().first() to match login's tolerance of legacy duplicates.
        user = (
            User.objects
            .filter(email__iexact=serializer.validated_data['email'].strip().lower())
            .order_by('id')
            .first()
        )
        if user is not None and user.is_active:
            send_password_reset_email(user)
        return Response({
            'message': 'If an account uses that email address, a reset link is on its way.',
        })


class PasswordResetConfirmView(APIView):
    """Trade a reset link for a new password.

    The token is bound to the password hash, so saving the new password kills
    the token: a second use of the same link always fails with 400.
    """
    authentication_classes = NO_SESSION_AUTH
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'auth'

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        return Response({'message': 'Your password has been reset. You can now log in.'})


class EmailVerificationView(APIView):
    """Confirm an address from the emailed link.

    Purely informational: it records that the address is reachable and never
    blocks anything — login and ordering work whether or not it was clicked
    (the "send link, never blocks" policy). The token is bound to
    ``email_verified``, so confirming kills the link: a replayed click fails
    with 400 instead of succeeding again.
    """
    authentication_classes = NO_SESSION_AUTH
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'auth'

    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        user.email_verified = True
        user.save(update_fields=['email_verified'])
        return Response({'message': 'Your email address has been confirmed.'})


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class   = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class TokenRefreshView(BaseTokenRefresh):
    """Refresh via the HttpOnly cookie (a body token is accepted as fallback).

    Rotation is on: the new refresh token goes straight back into the cookie
    and is stripped from the response body, so JavaScript only ever sees the
    short-lived access token.
    """
    authentication_classes = NO_SESSION_AUTH
    permission_classes = [permissions.AllowAny]
    throttle_classes   = [ScopedRateThrottle]
    throttle_scope     = 'auth'

    def post(self, request, *args, **kwargs):
        raw = request.data.get('refresh') or refresh_token_from_cookie(request)
        if not raw:
            return Response(
                {'detail': 'No refresh token provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # The serializer only needs {'refresh': ...}; a plain dict avoids the
        # request's immutable QueryDict entirely.
        serializer = self.get_serializer(data={'refresh': raw})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])
        data = serializer.validated_data
        rotated = data.pop('refresh', None)
        response = Response(data)
        if rotated:
            set_refresh_cookie(response, rotated)
        return response