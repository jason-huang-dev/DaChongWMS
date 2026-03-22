from __future__ import annotations

from rest_framework import serializers

from .models import CustomerAccount


class CustomerAccountSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = CustomerAccount
        fields = (
            "id",
            "organization_id",
            "name",
            "code",
            "contact_name",
            "contact_email",
            "contact_phone",
            "billing_email",
            "shipping_method",
            "allow_dropshipping_orders",
            "allow_inbound_goods",
            "notes",
            "is_active",
        )
        read_only_fields = ("id", "organization_id")
