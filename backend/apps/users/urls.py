from django.urls import path

from .views import (
    EmailVerificationView,
    LoginView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    TokenRefreshView,
)

urlpatterns = [
    path('register/',      RegisterView.as_view(),  name='auth-register'),
    path('login/',         LoginView.as_view(),      name='auth-login'),
    path('logout/',        LogoutView.as_view(),     name='auth-logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/',            MeView.as_view(),          name='auth-me'),
    path('password/reset/',         PasswordResetRequestView.as_view(), name='auth-password-reset'),
    path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),
    path('verify-email/',  EmailVerificationView.as_view(), name='auth-verify-email'),
]