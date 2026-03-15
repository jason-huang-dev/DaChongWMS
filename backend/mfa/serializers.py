"""Serializers for MFA enrollment and challenge endpoints."""

from __future__ import annotations

from rest_framework import serializers

from .models import MFAEnrollment


class TOTPEnrollmentCreateSerializer(serializers.Serializer[dict[str, object]]):
    label = serializers.CharField(required=False, allow_blank=True, default="Authenticator app", max_length=255)


class TOTPEnrollmentVerifySerializer(serializers.Serializer[dict[str, object]]):
    enrollment_id = serializers.PrimaryKeyRelatedField(queryset=MFAEnrollment.objects.filter(is_delete=False))
    code = serializers.CharField(max_length=32)


class MFAChallengeVerifySerializer(serializers.Serializer[dict[str, object]]):
    challenge_id = serializers.UUIDField()
    code = serializers.CharField(max_length=32)
