from __future__ import annotations

from rest_framework import serializers

from apps.organizations.models import MembershipType


class OrganizationUserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=255)
    membership_type = serializers.ChoiceField(
        choices=MembershipType.choices,
        default=MembershipType.INTERNAL,
    )
    role_code = serializers.CharField(max_length=100, required=False, allow_blank=False)
    customer_account_id = serializers.IntegerField(required=False, min_value=1)
