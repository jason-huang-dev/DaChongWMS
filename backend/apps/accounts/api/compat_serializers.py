from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers


class LegacyLoginSerializer(serializers.Serializer[dict[str, str]]):
    name = serializers.EmailField(max_length=255)
    password = serializers.CharField(trim_whitespace=False)

    def validate_name(self, value: str) -> str:
        return value.strip().lower()


class LegacySignupSerializer(serializers.Serializer[dict[str, str]]):
    name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password1 = serializers.CharField(trim_whitespace=False)
    password2 = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        if attrs["password1"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Password confirmation does not match."})
        validate_password(attrs["password1"])
        attrs["email"] = attrs["email"].strip().lower()
        attrs["name"] = attrs["name"].strip()
        return attrs
