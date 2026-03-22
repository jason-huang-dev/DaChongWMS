from __future__ import annotations

from rest_framework import serializers

from apps.organizations.models import OrganizationMembership
from apps.partners.models import ClientAccountAccess

from .models import User


class ClientAccountAccessSerializer(serializers.ModelSerializer):
    customer_account_id = serializers.IntegerField(source="customer_account.id", read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)
    customer_account_code = serializers.CharField(source="customer_account.code", read_only=True)

    class Meta:
        model = ClientAccountAccess
        fields = (
            "customer_account_id",
            "customer_account_name",
            "customer_account_code",
            "is_active",
        )


class MembershipSummarySerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(source="organization.id", read_only=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    customer_accounts = ClientAccountAccessSerializer(
        source="client_account_accesses",
        many=True,
        read_only=True,
    )

    class Meta:
        model = OrganizationMembership
        fields = (
            "organization_id",
            "organization_name",
            "membership_type",
            "is_active",
            "customer_accounts",
        )


class CurrentUserSerializer(serializers.ModelSerializer):
    memberships = MembershipSummarySerializer(
        source="organization_memberships",
        many=True,
        read_only=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "display_name",
            "is_active",
            "memberships",
        )
