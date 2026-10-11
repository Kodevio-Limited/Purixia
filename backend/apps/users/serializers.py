import re

from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import User
from .tokens import email_verification_token, user_from_uidb64


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    # The storefront labels username optional; when omitted we derive a unique
    # one from the email so registration never fails on a missing field.
    username = serializers.CharField(required=False, allow_blank=True, max_length=150)
    phone = serializers.CharField(required=False, allow_blank=True, max_length=15)
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = User
        fields = ('id', 'email', 'username', 'password', 'phone')

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_username(self, value):
        value = (value or '').strip()
        if value and User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_password(self, value):
        try:
            password_validation.validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        username = (validated_data.pop('username', '') or '').strip()
        email = validated_data['email']
        if not username:
            username = self._generate_username(email)
        return User.objects.create_user(username=username, **validated_data)

    @staticmethod
    def _generate_username(email: str) -> str:
        base = re.sub(r'[^a-zA-Z0-9._-]', '', email.split('@')[0])[:140] or 'user'
        candidate = base
        counter = 1
        while User.objects.filter(username__iexact=candidate).exists():
            suffix = str(counter)
            candidate = f'{base[:150 - len(suffix)]}{suffix}'
            counter += 1
        return candidate


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data['email'].strip().lower()
        # filter().first() instead of get(): legacy data may contain duplicate
        # emails, and get() would raise MultipleObjectsReturned (a 500).
        user = User.objects.filter(email__iexact=email).order_by('id').first()

        if user is None:
            # Run the hasher to keep response timing independent of whether the
            # account exists, so login cannot be used to enumerate emails.
            User().set_password(data['password'])
            raise serializers.ValidationError('Invalid credentials.')

        if not user.check_password(data['password']) or not user.is_active:
            raise serializers.ValidationError('Invalid credentials.')

        data['user'] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    email_verified = serializers.BooleanField(read_only=True)

    class Meta:
        model  = User
        fields = ('id', 'email', 'username', 'phone', 'email_verified')
        read_only_fields = ('email', 'username', 'email_verified')


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        # A bad uid/token is a normal outcome (expired link, second use,
        # tampered URL), never a 500 and never a hint about which half is
        # wrong — the answer is always a flat 400.
        user = user_from_uidb64(data['uid'])
        if user is None or not default_token_generator.check_token(user, data['token']):
            raise serializers.ValidationError('This link is invalid or has expired.')
        try:
            password_validation.validate_password(data['new_password'], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'new_password': list(exc.messages)})
        data['user'] = user
        return data


class EmailVerificationSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()

    def validate(self, data):
        user = user_from_uidb64(data['uid'])
        if user is None or not email_verification_token.check_token(user, data['token']):
            raise serializers.ValidationError('This link is invalid or has expired.')
        data['user'] = user
        return data
