from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.locations.models import Location, LocationLock, LocationStatus, LocationType, Zone, ZoneUsage
from apps.organizations.models import Organization
from apps.warehouse.models import Warehouse


@dataclass(frozen=True, slots=True)
class CreateZoneInput:
    organization: Organization
    warehouse: Warehouse
    code: str
    name: str
    usage: str = ZoneUsage.STORAGE
    sequence: int = 0
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class CreateLocationTypeInput:
    organization: Organization
    code: str
    name: str
    picking_enabled: bool = True
    putaway_enabled: bool = True
    allow_mixed_sku: bool = False
    max_weight: Decimal = Decimal("0.00")
    max_volume: Decimal = Decimal("0.0000")
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class CreateLocationInput:
    organization: Organization
    warehouse: Warehouse
    zone: Zone
    location_type: LocationType
    code: str
    name: str = ""
    aisle: str = ""
    bay: str = ""
    level: str = ""
    slot: str = ""
    barcode: str = ""
    capacity_qty: int = 0
    max_weight: Decimal = Decimal("0.00")
    max_volume: Decimal = Decimal("0.0000")
    pick_sequence: int = 0
    is_pick_face: bool = False
    status: str = LocationStatus.AVAILABLE
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class CreateLocationLockInput:
    organization: Organization
    location: Location
    reason: str
    locked_by: str
    notes: str = ""
    is_active: bool = True


def list_organization_zones(*, organization: Organization) -> list[Zone]:
    return list(
        Zone.objects.select_related("warehouse")
        .filter(organization=organization)
        .order_by("warehouse__name", "sequence", "code", "id")
    )


def create_zone(payload: CreateZoneInput) -> Zone:
    zone = Zone(
        organization=payload.organization,
        warehouse=payload.warehouse,
        code=payload.code,
        name=payload.name,
        usage=payload.usage,
        sequence=payload.sequence,
        is_active=payload.is_active,
    )
    zone.save()
    return zone


def update_zone(
    zone: Zone,
    *,
    warehouse: Warehouse | None = None,
    code: str | None = None,
    name: str | None = None,
    usage: str | None = None,
    sequence: int | None = None,
    is_active: bool | None = None,
) -> Zone:
    if warehouse is not None:
        zone.warehouse = warehouse
    if code is not None:
        zone.code = code
    if name is not None:
        zone.name = name
    if usage is not None:
        zone.usage = usage
    if sequence is not None:
        zone.sequence = sequence
    if is_active is not None:
        zone.is_active = is_active
    zone.save()
    return zone


def list_organization_location_types(*, organization: Organization) -> list[LocationType]:
    return list(
        LocationType.objects.filter(organization=organization).order_by("code", "id")
    )


def create_location_type(payload: CreateLocationTypeInput) -> LocationType:
    location_type = LocationType(
        organization=payload.organization,
        code=payload.code,
        name=payload.name,
        picking_enabled=payload.picking_enabled,
        putaway_enabled=payload.putaway_enabled,
        allow_mixed_sku=payload.allow_mixed_sku,
        max_weight=payload.max_weight,
        max_volume=payload.max_volume,
        is_active=payload.is_active,
    )
    location_type.save()
    return location_type


def update_location_type(
    location_type: LocationType,
    *,
    code: str | None = None,
    name: str | None = None,
    picking_enabled: bool | None = None,
    putaway_enabled: bool | None = None,
    allow_mixed_sku: bool | None = None,
    max_weight: Decimal | None = None,
    max_volume: Decimal | None = None,
    is_active: bool | None = None,
) -> LocationType:
    if code is not None:
        location_type.code = code
    if name is not None:
        location_type.name = name
    if picking_enabled is not None:
        location_type.picking_enabled = picking_enabled
    if putaway_enabled is not None:
        location_type.putaway_enabled = putaway_enabled
    if allow_mixed_sku is not None:
        location_type.allow_mixed_sku = allow_mixed_sku
    if max_weight is not None:
        location_type.max_weight = max_weight
    if max_volume is not None:
        location_type.max_volume = max_volume
    if is_active is not None:
        location_type.is_active = is_active
    location_type.save()
    return location_type


def list_organization_locations(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    zone_id: int | None = None,
    location_type_id: int | None = None,
    is_active: bool | None = None,
) -> list[Location]:
    queryset = Location.objects.select_related("warehouse", "zone", "location_type").filter(
        organization=organization
    )
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if zone_id is not None:
        queryset = queryset.filter(zone_id=zone_id)
    if location_type_id is not None:
        queryset = queryset.filter(location_type_id=location_type_id)
    if is_active is not None:
        queryset = queryset.filter(is_active=is_active)
    return list(queryset.order_by("warehouse__name", "pick_sequence", "code", "id"))


def create_location(payload: CreateLocationInput) -> Location:
    location = Location(
        organization=payload.organization,
        warehouse=payload.warehouse,
        zone=payload.zone,
        location_type=payload.location_type,
        code=payload.code,
        name=payload.name,
        aisle=payload.aisle,
        bay=payload.bay,
        level=payload.level,
        slot=payload.slot,
        barcode=payload.barcode,
        capacity_qty=payload.capacity_qty,
        max_weight=payload.max_weight,
        max_volume=payload.max_volume,
        pick_sequence=payload.pick_sequence,
        is_pick_face=payload.is_pick_face,
        status=payload.status,
        is_active=payload.is_active,
    )
    location.save()
    return location


def update_location(
    location: Location,
    *,
    warehouse: Warehouse | None = None,
    zone: Zone | None = None,
    location_type: LocationType | None = None,
    code: str | None = None,
    name: str | None = None,
    aisle: str | None = None,
    bay: str | None = None,
    level: str | None = None,
    slot: str | None = None,
    barcode: str | None = None,
    capacity_qty: int | None = None,
    max_weight: Decimal | None = None,
    max_volume: Decimal | None = None,
    pick_sequence: int | None = None,
    is_pick_face: bool | None = None,
    status: str | None = None,
    is_active: bool | None = None,
) -> Location:
    if warehouse is not None:
        location.warehouse = warehouse
    if zone is not None:
        location.zone = zone
    if location_type is not None:
        location.location_type = location_type
    if code is not None:
        location.code = code
    if name is not None:
        location.name = name
    if aisle is not None:
        location.aisle = aisle
    if bay is not None:
        location.bay = bay
    if level is not None:
        location.level = level
    if slot is not None:
        location.slot = slot
    if barcode is not None:
        location.barcode = barcode
    if capacity_qty is not None:
        location.capacity_qty = capacity_qty
    if max_weight is not None:
        location.max_weight = max_weight
    if max_volume is not None:
        location.max_volume = max_volume
    if pick_sequence is not None:
        location.pick_sequence = pick_sequence
    if is_pick_face is not None:
        location.is_pick_face = is_pick_face
    if status is not None:
        location.status = status
    if is_active is not None:
        location.is_active = is_active
    location.save()
    sync_location_lock_state(location)
    return location


def list_location_locks(
    *,
    organization: Organization,
    location_id: int | None = None,
    is_active: bool | None = None,
) -> list[LocationLock]:
    queryset = LocationLock.objects.select_related("location", "location__warehouse").filter(
        organization=organization
    )
    if location_id is not None:
        queryset = queryset.filter(location_id=location_id)
    if is_active is not None:
        queryset = queryset.filter(is_active=is_active)
    return list(queryset.order_by("-start_time", "-id"))


@transaction.atomic
def create_location_lock(payload: CreateLocationLockInput) -> LocationLock:
    location_lock = LocationLock(
        organization=payload.organization,
        location=payload.location,
        reason=payload.reason,
        notes=payload.notes,
        locked_by=payload.locked_by,
        is_active=payload.is_active,
    )
    location_lock.save()
    sync_location_lock_state(payload.location)
    return location_lock


@transaction.atomic
def update_location_lock(
    location_lock: LocationLock,
    *,
    reason: str | None = None,
    notes: str | None = None,
    is_active: bool | None = None,
    released_by: str | None = None,
    end_time: object | None = None,
    released_at: object | None = None,
) -> LocationLock:
    if reason is not None:
        location_lock.reason = reason
    if notes is not None:
        location_lock.notes = notes
    if is_active is not None:
        location_lock.is_active = is_active
    if released_by is not None:
        location_lock.released_by = released_by
    if end_time is not None:
        location_lock.end_time = end_time
    elif is_active is False and location_lock.end_time is None:
        location_lock.end_time = timezone.now()
    if released_at is not None:
        location_lock.released_at = released_at
    elif is_active is False and location_lock.released_at is None:
        location_lock.released_at = timezone.now()
    location_lock.save()
    sync_location_lock_state(location_lock.location)
    return location_lock


def sync_location_lock_state(location: Location) -> None:
    has_active_lock = location.locks.filter(is_active=True).exists()
    location.is_locked = has_active_lock
    if has_active_lock and location.status == LocationStatus.AVAILABLE:
        location.status = LocationStatus.BLOCKED
    elif not has_active_lock and location.status == LocationStatus.BLOCKED:
        location.status = LocationStatus.AVAILABLE
    location.save(update_fields=["is_locked", "status"])
