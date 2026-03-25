from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers


class CompatibilityStaffSerializer(serializers.Serializer[dict[str, object]]):
    staff_name = serializers.CharField(max_length=255)
    staff_type = serializers.CharField(max_length=255)
    check_code = serializers.IntegerField(min_value=1000, max_value=9999)
    is_lock = serializers.BooleanField(default=False)


class CompatibilityCompanyMembershipSerializer(serializers.Serializer[dict[str, object]]):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(
        required=False,
        allow_blank=True,
        trim_whitespace=False,
        default="",
    )
    staff_name = serializers.CharField(max_length=255)
    staff_type = serializers.CharField(max_length=255)
    check_code = serializers.IntegerField(min_value=1000, max_value=9999)
    is_lock = serializers.BooleanField(default=False)
    is_company_admin = serializers.BooleanField(default=False)
    can_manage_users = serializers.BooleanField(default=False)
    is_active = serializers.BooleanField(default=True)
    default_warehouse = serializers.IntegerField(required=False, allow_null=True, min_value=1)


class CompatibilityInviteSerializer(serializers.Serializer[dict[str, object]]):
    email = serializers.EmailField()
    staff_name = serializers.CharField(max_length=255)
    staff_type = serializers.CharField(max_length=255)
    check_code = serializers.IntegerField(min_value=1000, max_value=9999)
    default_warehouse = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    is_company_admin = serializers.BooleanField(default=False)
    can_manage_users = serializers.BooleanField(default=False)
    invite_message = serializers.CharField(required=False, allow_blank=True, default="")
    expires_in_days = serializers.IntegerField(min_value=1, max_value=30, default=7)


class CompatibilityPasswordResetSerializer(serializers.Serializer[dict[str, object]]):
    membership = serializers.IntegerField(min_value=1)
    expires_in_hours = serializers.IntegerField(min_value=1, max_value=168, default=24)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CompatibilityInviteAcceptanceSerializer(serializers.Serializer[dict[str, str]]):
    invite_token = serializers.CharField(max_length=255)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        attrs["invite_token"] = attrs["invite_token"].strip()
        attrs["username"] = attrs["username"].strip()
        validate_password(attrs["password"])
        return attrs


class CompatibilityPasswordResetCompletionSerializer(serializers.Serializer[dict[str, str]]):
    reset_token = serializers.CharField(max_length=255)
    password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs: dict[str, str]) -> dict[str, str]:
        attrs["reset_token"] = attrs["reset_token"].strip()
        validate_password(attrs["password"])
        return attrs
