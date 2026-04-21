from __future__ import annotations

from rest_framework import serializers

from apps.accounts.services.onboarding_service import OnboardingStatus, WarehouseSetupInput, WarehouseSetupResult


class WorkspaceOnboardingStatusSerializer(serializers.Serializer[dict[str, object]]):
    is_required = serializers.BooleanField()
    can_manage_setup = serializers.BooleanField()
    warehouse_count = serializers.IntegerField()
    storage_area_count = serializers.IntegerField()
    location_type_count = serializers.IntegerField()
    location_count = serializers.IntegerField()

    @classmethod
    def from_status(cls, onboarding_status: OnboardingStatus) -> dict[str, object]:
        return {
            "is_required": onboarding_status.is_required,
            "can_manage_setup": onboarding_status.can_manage_setup,
            "warehouse_count": onboarding_status.warehouse_count,
            "storage_area_count": onboarding_status.storage_area_count,
            "location_type_count": onboarding_status.location_type_count,
            "location_count": onboarding_status.location_count,
        }


class WorkspaceSetupSerializer(serializers.Serializer[dict[str, object]]):
    warehouse_name = serializers.CharField(max_length=255, default="Main Warehouse")
    warehouse_code = serializers.RegexField(
        regex=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$",
        max_length=50,
        default="MAIN",
    )
    storage_area_name = serializers.CharField(max_length=255, default="Primary Storage")
    storage_area_code = serializers.RegexField(
        regex=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$",
        max_length=64,
        default="STOR",
    )
    location_type_name = serializers.CharField(max_length=255, default="Storage Bin")
    location_type_code = serializers.RegexField(
        regex=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$",
        max_length=64,
        default="BIN",
    )
    shelf_prefix = serializers.RegexField(
        regex=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,11}$",
        max_length=12,
        default="A",
    )
    aisle_count = serializers.IntegerField(min_value=1, max_value=20, default=2)
    bay_count = serializers.IntegerField(min_value=1, max_value=50, default=4)
    level_count = serializers.IntegerField(min_value=1, max_value=10, default=3)
    slot_count = serializers.IntegerField(min_value=1, max_value=20, default=1)

    def to_setup_input(self) -> WarehouseSetupInput:
        return WarehouseSetupInput(
            warehouse_name=self.validated_data["warehouse_name"],
            warehouse_code=self.validated_data["warehouse_code"],
            storage_area_name=self.validated_data["storage_area_name"],
            storage_area_code=self.validated_data["storage_area_code"],
            location_type_name=self.validated_data["location_type_name"],
            location_type_code=self.validated_data["location_type_code"],
            shelf_prefix=self.validated_data["shelf_prefix"],
            aisle_count=self.validated_data["aisle_count"],
            bay_count=self.validated_data["bay_count"],
            level_count=self.validated_data["level_count"],
            slot_count=self.validated_data["slot_count"],
        )


class WorkspaceSetupResultSerializer(serializers.Serializer[dict[str, object]]):
    warehouse_id = serializers.IntegerField()
    warehouse_name = serializers.CharField()
    storage_area_id = serializers.IntegerField()
    storage_area_code = serializers.CharField()
    location_type_id = serializers.IntegerField()
    location_type_code = serializers.CharField()
    created_location_count = serializers.IntegerField()
    status = WorkspaceOnboardingStatusSerializer()

    @classmethod
    def from_result(cls, result: WarehouseSetupResult) -> dict[str, object]:
        return {
            "warehouse_id": result.warehouse.id,
            "warehouse_name": result.warehouse.name,
            "storage_area_id": result.zone.id,
            "storage_area_code": result.zone.code,
            "location_type_id": result.location_type.id,
            "location_type_code": result.location_type.code,
            "created_location_count": result.created_location_count,
            "status": WorkspaceOnboardingStatusSerializer.from_status(result.status),
        }
