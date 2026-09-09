from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefresh
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import LoginSerializer, RegisterSerializer, UserSerializer


# No auth classes = no CSRF enforcement on these endpoints.
# The frontend uses JWT (Bearer tokens), not sessions.
NO_SESSION_AUTH = []


def _token_response(user):
    """Return access + refresh tokens for a user."""
    refresh = RefreshToken.for_user(user)
    return {
        'access':  str(refresh.access_token),
        'refresh': str(refresh),
    }


class RegisterView(generics.CreateAPIView):
    queryset            = User.objects.all()
    serializer_class    = RegisterSerializer
    authentication_classes = NO_SESSION_AUTH
    permission_classes  = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                'user': UserSerializer(user).data,
                'tokens': _token_response(user)
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    authentication_classes = NO_SESSION_AUTH
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        return Response(
            {
                'user': UserSerializer(user).data, 
                'tokens': _token_response(user)
            },
        )


class LogoutView(APIView):
    """Blacklist the refresh token and clear session."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data['refresh'])
            token.blacklist()
        except Exception:
            return Response(
                {
                    'error': 'Invalid or expired token.'
                }, 
                status=status.HTTP_400_BAD_REQUEST)
        return Response({'message': 'Logged out.'}, status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class   = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class TokenRefreshView(BaseTokenRefresh):
    """Token refresh without CSRF enforcement (cross-origin frontend)."""
    authentication_classes = NO_SESSION_AUTH
    permission_classes = [permissions.AllowAny]