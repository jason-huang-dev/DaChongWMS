from __future__ import annotations

from rest_framework import serializers

from .models import Warehouse


class WarehouseSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Warehouse
        fields = (
            "id",
            "organization_id",
            "name",
            "code",
            "is_active",
        )
        read_only_fields = ("id", "organization_id")
