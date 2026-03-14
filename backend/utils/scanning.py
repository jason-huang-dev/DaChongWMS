"""Shared helpers for scan-first warehouse execution flows."""

from __future__ import annotations

import re

from django.db.models import Q
from rest_framework.exceptions import APIException

from catalog.goods.models import ListModel as Goods
from locations.models import Location
from scanner.models import AliasTargetType, BarcodeAlias, GoodsScanRule, LicensePlate
from warehouse.models import Warehouse


def resolve_goods_by_scan_code(*, openid: str, scan_code: str) -> Goods:
    goods = (
        Goods.objects.filter(openid=openid, is_delete=False)
        .filter(Q(bar_code=scan_code) | Q(goods_code=scan_code))
        .first()
    )
    if goods is not None:
        return goods
    alias = (
        BarcodeAlias.objects.select_related("goods")
        .filter(openid=openid, target_type=AliasTargetType.GOODS, alias_code=scan_code, is_delete=False)
        .first()
    )
    if alias is None or alias.goods is None:
        raise APIException({"detail": f"No goods record matched scan `{scan_code}`"})
    return alias.goods


def resolve_location_by_scan_code(*, openid: str, warehouse: Warehouse, scan_code: str) -> Location:
    location = (
        Location.objects.select_related("zone", "location_type")
        .filter(openid=openid, warehouse=warehouse, is_delete=False)
        .filter(Q(barcode=scan_code) | Q(location_code=scan_code))
        .first()
    )
    if location is not None:
        return location
    alias = (
        BarcodeAlias.objects.select_related("location", "location__zone", "location__location_type")
        .filter(openid=openid, target_type=AliasTargetType.LOCATION, alias_code=scan_code, is_delete=False)
        .first()
    )
    if alias is None or alias.location is None or alias.location.warehouse_id != warehouse.id:
        raise APIException({"detail": f"No location matched scan `{scan_code}` in warehouse `{warehouse.warehouse_name}`"})
    return alias.location


def resolve_license_plate_by_scan_code(*, openid: str, warehouse: Warehouse, scan_code: str) -> LicensePlate:
    license_plate = (
        LicensePlate.objects.select_related("goods", "current_location")
        .filter(openid=openid, warehouse=warehouse, lpn_code=scan_code, is_delete=False)
        .first()
    )
    if license_plate is None:
        raise APIException({"detail": f"No license plate matched scan `{scan_code}` in warehouse `{warehouse.warehouse_name}`"})
    return license_plate


def extract_scan_attributes(*, attribute_scan: str) -> tuple[str, str]:
    lot_number = ""
    serial_number = ""
    if not attribute_scan.strip():
        return lot_number, serial_number
    for token in re.split(r"[|;,]+", attribute_scan):
        part = token.strip()
        if not part:
            continue
        if ":" in part:
            key, value = part.split(":", 1)
        elif "=" in part:
            key, value = part.split("=", 1)
        else:
            continue
        normalized_key = key.strip().upper()
        normalized_value = value.strip()
        if normalized_key in {"LOT", "LOT_NUMBER", "BATCH"}:
            lot_number = normalized_value
        elif normalized_key in {"SERIAL", "SERIAL_NUMBER", "SN"}:
            serial_number = normalized_value
    return lot_number, serial_number


def resolve_and_validate_scan_attributes(
    *,
    openid: str,
    goods: Goods,
    lot_number: str,
    serial_number: str,
    attribute_scan: str = "",
) -> tuple[str, str]:
    if attribute_scan:
        parsed_lot_number, parsed_serial_number = extract_scan_attributes(attribute_scan=attribute_scan)
        if not lot_number:
            lot_number = parsed_lot_number
        if not serial_number:
            serial_number = parsed_serial_number

    rule = GoodsScanRule.objects.filter(openid=openid, goods=goods, is_delete=False).first()
    if rule is None:
        return lot_number, serial_number
    if rule.requires_lot and not lot_number:
        raise APIException({"detail": f"Goods `{goods.goods_code}` require a lot number scan"})
    if rule.requires_serial and not serial_number:
        raise APIException({"detail": f"Goods `{goods.goods_code}` require a serial number scan"})
    if rule.lot_pattern and lot_number and re.fullmatch(rule.lot_pattern, lot_number) is None:
        raise APIException({"detail": f"Lot number `{lot_number}` does not match the configured rule for `{goods.goods_code}`"})
    if rule.serial_pattern and serial_number and re.fullmatch(rule.serial_pattern, serial_number) is None:
        raise APIException({"detail": f"Serial number `{serial_number}` does not match the configured rule for `{goods.goods_code}`"})
    return lot_number, serial_number
