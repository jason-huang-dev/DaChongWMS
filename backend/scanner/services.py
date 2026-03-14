"""Domain helpers for barcode aliases and license-plate updates."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import APIException

from inventory.services import ensure_tenant_match
from locations.models import Location
from warehouse.models import Warehouse

from .models import LicensePlate, LicensePlateStatus


@transaction.atomic
def upsert_license_plate_receipt(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    goods,
    lpn_code: str,
    quantity: Decimal,
    location: Location,
    lot_number: str,
    serial_number: str,
    reference_code: str = "",
    notes: str = "",
) -> LicensePlate:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(goods, openid, "Goods")
    ensure_tenant_match(location, openid, "Location")
    license_plate, created = LicensePlate.objects.select_for_update().get_or_create(
        openid=openid,
        lpn_code=lpn_code,
        is_delete=False,
        defaults={
            "warehouse": warehouse,
            "goods": goods,
            "current_location": location,
            "quantity": quantity,
            "lot_number": lot_number,
            "serial_number": serial_number,
            "status": LicensePlateStatus.RECEIVED,
            "reference_code": reference_code,
            "notes": notes,
            "creator": operator_name,
        },
    )
    if created:
        return license_plate
    if license_plate.warehouse_id != warehouse.id:
        raise APIException({"detail": f"License plate `{lpn_code}` belongs to a different warehouse"})
    if license_plate.goods_id != goods.id:
        raise APIException({"detail": f"License plate `{lpn_code}` belongs to a different SKU"})
    if license_plate.lot_number and lot_number and license_plate.lot_number != lot_number:
        raise APIException({"detail": f"License plate `{lpn_code}` lot number does not match the scanned lot"})
    if license_plate.serial_number and serial_number and license_plate.serial_number != serial_number:
        raise APIException({"detail": f"License plate `{lpn_code}` serial number does not match the scanned serial"})
    license_plate.quantity += quantity
    license_plate.current_location = location
    license_plate.lot_number = lot_number or license_plate.lot_number
    license_plate.serial_number = serial_number or license_plate.serial_number
    license_plate.status = LicensePlateStatus.RECEIVED
    license_plate.reference_code = reference_code or license_plate.reference_code
    if notes:
        license_plate.notes = notes
    license_plate.save(
        update_fields=[
            "quantity",
            "current_location",
            "lot_number",
            "serial_number",
            "status",
            "reference_code",
            "notes",
            "update_time",
        ]
    )
    return license_plate


@transaction.atomic
def transition_license_plate(
    *,
    openid: str,
    license_plate: LicensePlate,
    location: Location | None,
    status: str,
    reference_code: str = "",
    notes: str = "",
) -> LicensePlate:
    ensure_tenant_match(license_plate, openid, "License plate")
    locked_plate = LicensePlate.objects.select_for_update().get(pk=license_plate.pk)
    if location is not None:
        ensure_tenant_match(location, openid, "Location")
        if locked_plate.warehouse_id != location.warehouse_id:
            raise APIException({"detail": "License plate cannot move across warehouses"})
        locked_plate.current_location = location
    locked_plate.status = status
    if reference_code:
        locked_plate.reference_code = reference_code
    if notes:
        locked_plate.notes = notes
    locked_plate.save(update_fields=["current_location", "status", "reference_code", "notes", "update_time"])
    return locked_plate
