from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction

from apps.iam.constants import PermissionCode
from apps.iam.permissions import membership_has_any_permission, membership_has_permission
from apps.locations.models import Location, LocationStatus, LocationType, Zone, ZoneUsage
from apps.organizations.models import MembershipType, OrganizationMembership, OrganizationStaffProfile
from apps.warehouse.models import Warehouse


@dataclass(frozen=True, slots=True)
class OnboardingStatus:
    is_required: bool
    can_manage_setup: bool
    warehouse_count: int
    storage_area_count: int
    location_type_count: int
    location_count: int


@dataclass(frozen=True, slots=True)
class WarehouseSetupInput:
    warehouse_name: str
    warehouse_code: str
    storage_area_name: str
    storage_area_code: str
    location_type_name: str
    location_type_code: str
    shelf_prefix: str
    aisle_count: int
    bay_count: int
    level_count: int
    slot_count: int


@dataclass(frozen=True, slots=True)
class WarehouseSetupResult:
    warehouse: Warehouse
    zone: Zone
    location_type: LocationType
    created_location_count: int
    status: OnboardingStatus


def can_manage_workspace_setup(membership: OrganizationMembership) -> bool:
    if membership.membership_type != MembershipType.INTERNAL:
        return False
    can_manage_warehouse = membership_has_any_permission(
        membership,
        (
            PermissionCode.ADD_WAREHOUSE,
            PermissionCode.CHANGE_WAREHOUSE,
        ),
    )
    can_manage_topology = membership_has_permission(
        membership,
        PermissionCode.MANAGE_LOCATION_TOPOLOGY,
    )
    return can_manage_warehouse and can_manage_topology


def get_onboarding_status(membership: OrganizationMembership) -> OnboardingStatus:
    organization = membership.organization
    warehouse_count = Warehouse.objects.filter(organization=organization, is_active=True).count()
    storage_area_count = Zone.objects.filter(organization=organization, is_active=True).count()
    location_type_count = LocationType.objects.filter(organization=organization, is_active=True).count()
    location_count = Location.objects.filter(organization=organization, is_active=True).count()
    can_manage_setup = can_manage_workspace_setup(membership)
    is_required = can_manage_setup and any(
        count == 0
        for count in (
            warehouse_count,
            storage_area_count,
            location_type_count,
            location_count,
        )
    )
    return OnboardingStatus(
        is_required=is_required,
        can_manage_setup=can_manage_setup,
        warehouse_count=warehouse_count,
        storage_area_count=storage_area_count,
        location_type_count=location_type_count,
        location_count=location_count,
    )


def _normalize_code(value: str) -> str:
    return value.strip().upper()


def _location_code(*, prefix: str, aisle: int, bay: int, level: int, slot: int) -> str:
    return f"{prefix}-{aisle:02d}-{bay:02d}-{level:02d}-{slot:02d}"


@transaction.atomic
def create_workspace_setup(
    *,
    membership: OrganizationMembership,
    payload: WarehouseSetupInput,
) -> WarehouseSetupResult:
    organization = membership.organization
    warehouse_code = _normalize_code(payload.warehouse_code)
    storage_area_code = _normalize_code(payload.storage_area_code)
    location_type_code = _normalize_code(payload.location_type_code)
    shelf_prefix = _normalize_code(payload.shelf_prefix)

    warehouse, _ = Warehouse.objects.get_or_create(
        organization=organization,
        code=warehouse_code,
        defaults={
            "name": payload.warehouse_name,
            "is_active": True,
        },
    )
    warehouse_updates: list[str] = []
    if not warehouse.is_active:
        warehouse.is_active = True
        warehouse_updates.append("is_active")
    if not warehouse.name.strip():
        warehouse.name = payload.warehouse_name
        warehouse_updates.append("name")
    if warehouse_updates:
        warehouse.save(update_fields=warehouse_updates)

    location_type, _ = LocationType.objects.get_or_create(
        organization=organization,
        code=location_type_code,
        defaults={
            "name": payload.location_type_name,
            "picking_enabled": True,
            "putaway_enabled": True,
            "allow_mixed_sku": False,
            "max_weight": Decimal("0.00"),
            "max_volume": Decimal("0.0000"),
            "is_active": True,
        },
    )
    if not location_type.is_active:
        location_type.is_active = True
        location_type.save(update_fields=["is_active"])

    zone, _ = Zone.objects.get_or_create(
        warehouse=warehouse,
        code=storage_area_code,
        defaults={
            "organization": organization,
            "name": payload.storage_area_name,
            "usage": ZoneUsage.STORAGE,
            "sequence": 10,
            "is_active": True,
        },
    )
    zone_updates: list[str] = []
    if zone.organization_id != organization.id:
        zone.organization = organization
        zone_updates.append("organization")
    if not zone.is_active:
        zone.is_active = True
        zone_updates.append("is_active")
    if zone_updates:
        zone.save(update_fields=zone_updates)

    created_location_count = 0
    pick_sequence = 0
    for aisle in range(1, payload.aisle_count + 1):
        for bay in range(1, payload.bay_count + 1):
            for level in range(1, payload.level_count + 1):
                for slot in range(1, payload.slot_count + 1):
                    pick_sequence += 10
                    code = _location_code(
                        prefix=shelf_prefix,
                        aisle=aisle,
                        bay=bay,
                        level=level,
                        slot=slot,
                    )
                    _, created = Location.objects.get_or_create(
                        warehouse=warehouse,
                        code=code,
                        defaults={
                            "organization": organization,
                            "zone": zone,
                            "location_type": location_type,
                            "name": f"Shelf {code}",
                            "aisle": f"{aisle:02d}",
                            "bay": f"{bay:02d}",
                            "level": f"{level:02d}",
                            "slot": f"{slot:02d}",
                            "barcode": code,
                            "capacity_qty": 0,
                            "max_weight": Decimal("0.00"),
                            "max_volume": Decimal("0.0000"),
                            "pick_sequence": pick_sequence,
                            "is_pick_face": False,
                            "status": LocationStatus.AVAILABLE,
                            "is_active": True,
                        },
                    )
                    if created:
                        created_location_count += 1

    OrganizationStaffProfile.objects.filter(
        membership=membership,
        default_warehouse__isnull=True,
    ).update(default_warehouse=warehouse)

    return WarehouseSetupResult(
        warehouse=warehouse,
        zone=zone,
        location_type=location_type,
        created_location_count=created_location_count,
        status=get_onboarding_status(membership),
    )
