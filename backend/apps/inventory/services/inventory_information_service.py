from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from functools import cmp_to_key
from typing import Any

from apps.inbound.models import PurchaseOrder, PutawayTask
from apps.inventory.models import InventoryBalance, InventoryInformationImportRecord
from apps.locations.models import Location
from apps.organizations.models import Organization
from apps.outbound.models import SalesOrder
from apps.partners.models import CustomerAccount
from apps.products.models import DistributionProduct, Product
from apps.warehouse.models import Warehouse

_CLOSED_STATUSES = {"CLOSED", "COMPLETED", "DONE", "RECEIVED"}
_CANCELLED_STATUSES = {"CANCELLED"}
_DEFECTIVE_KEYWORDS = ("DEFECT", "DAMAGE", "DAMAGED", "QC", "QUAR", "RETURN")
_AREA_DEFINITIONS = (
    ("receiving", "Receiving"),
    ("storage", "Storage"),
    ("picking", "Picking"),
    ("staging", "Staging"),
    ("defect", "Defect"),
    ("unassigned", "Unassigned"),
)
_AREA_MATCHERS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("defect", ("DEFECT", "DAMAGE", "DAMAGED", "QC", "QUAR", "RETURN")),
    ("picking", ("PICK", "PICKFACE", "FORWARD")),
    ("staging", ("STAGE", "STAGING", "PACK", "DOCK", "SHIP")),
    ("receiving", ("RCV", "RECV", "RECEIVE", "RECEIVING", "INBOUND")),
    ("storage", ("STOR", "STORAGE", "BULK", "RESERVE", "PUTAWAY", "RACK")),
)
_QUERY_FIELD_DEFINITIONS: dict[str, dict[str, Any]] = {
    "areaKey": {
        "aliases": ("area",),
        "match_mode": "exact",
        "reader": lambda row: [row["areaKey"], row["areaLabel"]],
    },
    "merchantSku": {
        "aliases": ("sku", "merchantsku", "merchant_sku"),
        "match_mode": "exact",
        "reader": lambda row: [row["merchantSku"]],
    },
    "productName": {
        "aliases": ("product", "name", "productname", "product_name"),
        "match_mode": "contains",
        "reader": lambda row: [row["productName"], row["productBarcode"], row["productDescription"]],
    },
    "merchantCode": {
        "aliases": ("merchant", "merchantcode", "merchant_code", "code"),
        "match_mode": "contains",
        "reader": lambda row: [row["merchantCode"]],
    },
    "client": {
        "aliases": ("client", "customer"),
        "match_mode": "contains",
        "reader": lambda row: [
            row["customerCode"],
            *[value for client in row["clients"] for value in (client["code"], client["name"], client["label"])],
        ],
    },
    "clientCode": {
        "aliases": ("clientcode", "client_code", "clientid", "client_id", "customercode", "customer_code"),
        "match_mode": "contains",
        "reader": lambda row: [row["customerCode"], *[client["code"] for client in row["clients"]]],
    },
    "warehouseName": {
        "aliases": ("warehouse",),
        "match_mode": "contains",
        "reader": lambda row: [row["warehouseName"]],
    },
    "tag": {
        "aliases": ("tag", "tags"),
        "match_mode": "contains",
        "reader": lambda row: row["productTags"],
    },
    "barcode": {
        "aliases": ("barcode",),
        "match_mode": "contains",
        "reader": lambda row: [row["productBarcode"]],
    },
    "brand": {
        "aliases": ("brand",),
        "match_mode": "contains",
        "reader": lambda row: [row["productBrand"]],
    },
    "category": {
        "aliases": ("category",),
        "match_mode": "contains",
        "reader": lambda row: [row["productCategory"]],
    },
    "shelf": {
        "aliases": ("shelf", "location", "bin"),
        "match_mode": "contains",
        "reader": lambda row: [row["shelf"], *row["shelves"]],
    },
    "zoneCode": {
        "aliases": ("zone", "zonecode", "zone_code"),
        "match_mode": "contains",
        "reader": lambda row: [row["zoneCode"], *row["zoneCodes"]],
    },
    "locationTypeCode": {
        "aliases": ("type", "locationtype", "location_type"),
        "match_mode": "contains",
        "reader": lambda row: [row["locationTypeCode"], *row["locationTypeCodes"]],
    },
    "source": {
        "aliases": ("source",),
        "match_mode": "exact",
        "reader": lambda row: [row["source"]],
    },
    "stockStatus": {
        "aliases": ("status", "stockstatus", "stock_status"),
        "match_mode": "contains",
        "reader": lambda row: [row["stockStatus"], *row["stockStatuses"]],
    },
    "availableStock": {
        "aliases": ("available", "availablestock", "available_stock"),
        "match_mode": "exact",
        "reader": lambda row: [_numeric_field_value(row["availableStock"])],
    },
    "orderAllocated": {
        "aliases": ("allocated", "orderallocated", "order_allocated"),
        "match_mode": "exact",
        "reader": lambda row: [_numeric_field_value(row["orderAllocated"])],
    },
    "pendingReceival": {
        "aliases": ("pending", "pendingreceival", "pending_receival", "receival"),
        "match_mode": "exact",
        "reader": lambda row: [_numeric_field_value(row["pendingReceival"])],
    },
    "inTransit": {
        "aliases": ("transit", "intransit", "in_transit"),
        "match_mode": "exact",
        "reader": lambda row: [_numeric_field_value(row["inTransit"])],
    },
    "toList": {
        "aliases": ("tolist", "to_list"),
        "match_mode": "exact",
        "reader": lambda row: [_numeric_field_value(row["toList"])],
    },
    "defectiveProducts": {
        "aliases": ("defective", "defectiveproducts", "defective_products"),
        "match_mode": "exact",
        "reader": lambda row: [_numeric_field_value(row["defectiveProducts"])],
    },
    "totalInventory": {
        "aliases": ("total", "inventory", "totalinventory", "total_inventory"),
        "match_mode": "exact",
        "reader": lambda row: [_numeric_field_value(row["totalInventory"])],
    },
}
_QUERY_ALIAS_MAP = {
    alias: field
    for field, definition in _QUERY_FIELD_DEFINITIONS.items()
    for alias in definition["aliases"]
}
_SORT_READERS = {
    "merchantSku": lambda row: row["merchantSku"],
    "merchantCode": lambda row: row["merchantCode"],
    "productName": lambda row: row["productName"] or row["merchantSku"],
    "productBarcode": lambda row: row["productBarcode"],
    "warehouseName": lambda row: row["warehouseName"],
    "client": lambda row: _primary_client_label(row),
    "inTransit": lambda row: row["inTransit"],
    "pendingReceival": lambda row: row["pendingReceival"],
    "toList": lambda row: row["toList"],
    "orderAllocated": lambda row: row["orderAllocated"],
    "availableStock": lambda row: row["availableStock"],
    "defectiveProducts": lambda row: row["defectiveProducts"],
    "totalInventory": lambda row: row["totalInventory"],
}


@dataclass(frozen=True, slots=True)
class InventoryInformationFilters:
    query: str = ""
    warehouses: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    clients: tuple[str, ...] = ()
    merchant_skus: tuple[str, ...] = ()
    inventory_count_min: str = ""
    inventory_count_max: str = ""
    hide_zero_stock: bool = False


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_upper_text(value: Any) -> str:
    return _normalize_text(value).upper()


def _normalize_boolean(value: Any) -> bool:
    return _normalize_upper_text(value) in {"1", "TRUE", "YES", "ON"}


def _normalize_location_code(value: Any) -> str:
    return _normalize_upper_text(value)


def _to_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _decimal_to_number(value: Any) -> int | float:
    decimal_value = _to_decimal(value) or Decimal("0")
    return int(decimal_value) if decimal_value == decimal_value.to_integral() else float(decimal_value)


def _numeric_field_value(value: int | float) -> str:
    decimal_value = _to_decimal(value) or Decimal("0")
    normalized = decimal_value.normalize()
    return format(normalized, "f").rstrip("0").rstrip(".") or "0"


def _natural_sort_key(value: Any) -> tuple[Any, ...]:
    parts = re.split(r"(\d+)", _normalize_text(value))
    return tuple((1, int(part)) if part.isdigit() else (0, part.casefold()) for part in parts if part)


def _compare_text(left: Any, right: Any) -> int:
    left_key = _natural_sort_key(left)
    right_key = _natural_sort_key(right)
    if left_key == right_key:
        return 0
    return -1 if left_key < right_key else 1


def _compare_numbers(left: int | float, right: int | float) -> int:
    if left == right:
        return 0
    return -1 if left < right else 1


def _unique_sorted(values: list[str]) -> list[str]:
    return sorted({_normalize_text(value) for value in values if _normalize_text(value)}, key=_natural_sort_key)


def _build_warehouse_sku_key(warehouse_name: str, merchant_sku: str) -> str:
    return f"{_normalize_upper_text(warehouse_name)}::{_normalize_upper_text(merchant_sku)}"


def _is_cancelled_status(value: str) -> bool:
    return _normalize_upper_text(value) in _CANCELLED_STATUSES


def _is_closed_status(value: str) -> bool:
    return _normalize_upper_text(value) in _CLOSED_STATUSES


def _is_defective_stock_status(value: str) -> bool:
    normalized = _normalize_upper_text(value)
    return any(keyword in normalized for keyword in _DEFECTIVE_KEYWORDS)


def _area_label(area_key: str) -> str:
    for key, label in _AREA_DEFINITIONS:
        if key == area_key:
            return label
    return "Unassigned"


def _resolve_area(zone_code: str, location_type_code: str) -> dict[str, str]:
    normalized_zone_code = _normalize_upper_text(zone_code)
    normalized_location_type_code = _normalize_upper_text(location_type_code)
    combined = f"{normalized_zone_code} {normalized_location_type_code}".strip()
    matched_area = "storage" if combined else "unassigned"
    for area_key, keywords in _AREA_MATCHERS:
        if any(keyword in combined for keyword in keywords):
            matched_area = area_key
            break
    return {
        "areaKey": matched_area,
        "areaLabel": _area_label(matched_area),
        "zoneCode": normalized_zone_code,
        "locationTypeCode": normalized_location_type_code,
    }


def _default_location_metadata() -> dict[str, Any]:
    return {
        "areaKey": "unassigned",
        "areaLabel": _area_label("unassigned"),
        "zoneCode": "",
        "zoneCodes": [],
        "locationTypeCode": "",
        "locationTypeCodes": [],
    }


def _build_client_payload(code: str, client_name_by_code: dict[str, str]) -> dict[str, str] | None:
    normalized_code = _normalize_upper_text(code)
    if not normalized_code:
        return None
    name = client_name_by_code.get(normalized_code, "")
    return {
        "code": normalized_code,
        "name": name,
        "label": f"{name} [{normalized_code}]" if name else normalized_code,
    }


def _merge_clients(*client_groups: list[dict[str, str]]) -> list[dict[str, str]]:
    clients_by_code: dict[str, dict[str, str]] = {}
    for client in [client for group in client_groups for client in group]:
        if client.get("code"):
            clients_by_code[client["code"]] = client
    return sorted(clients_by_code.values(), key=lambda client: _natural_sort_key(client["label"]))


def _resolve_primary_client(
    explicit_customer_code: str,
    preferred_client: dict[str, str] | None,
    clients: list[dict[str, str]],
    client_name_by_code: dict[str, str],
) -> dict[str, str] | None:
    normalized_code = _normalize_upper_text(explicit_customer_code)
    explicit_client = next((client for client in clients if client["code"] == normalized_code), None)
    if explicit_client is None and normalized_code:
        explicit_client = _build_client_payload(normalized_code, client_name_by_code)
    return explicit_client or preferred_client or (clients[0] if clients else None)


@dataclass(slots=True)
class _MetricAggregate:
    total: int | float = 0
    by_client_code: dict[str, int | float] | None = None
    client_codes: set[str] | None = None

    def __post_init__(self) -> None:
        if self.by_client_code is None:
            self.by_client_code = {}
        if self.client_codes is None:
            self.client_codes = set()


def _accumulate_aggregate(
    lookup: dict[str, _MetricAggregate],
    warehouse_name: str,
    merchant_sku: str,
    customer_code: str,
    quantity: int | float,
) -> None:
    if not quantity:
        return
    key = _build_warehouse_sku_key(warehouse_name, merchant_sku)
    aggregate = lookup.get(key) or _MetricAggregate()
    aggregate.total += quantity
    normalized_customer_code = _normalize_upper_text(customer_code)
    if normalized_customer_code:
        aggregate.client_codes.add(normalized_customer_code)
        aggregate.by_client_code[normalized_customer_code] = aggregate.by_client_code.get(normalized_customer_code, 0) + quantity
    lookup[key] = aggregate


def _resolve_aggregate_quantity(
    aggregate: _MetricAggregate | None,
    explicit_customer_code: str,
    fallback_quantity: int | float,
) -> int | float:
    if aggregate is None:
        return fallback_quantity
    normalized_customer_code = _normalize_upper_text(explicit_customer_code)
    if normalized_customer_code:
        return aggregate.by_client_code.get(normalized_customer_code, 0)
    return max(fallback_quantity, aggregate.total)


def _to_positive_difference(total: Decimal, completed: Decimal) -> int | float:
    return _decimal_to_number(max(total - completed, Decimal("0")))


def _build_distribution_metadata_by_sku(
    distribution_products: list[DistributionProduct],
    client_name_by_code: dict[str, str],
) -> dict[str, dict[str, Any]]:
    metadata_by_sku: dict[str, dict[str, Any]] = {}
    for distribution_product in distribution_products:
        if not distribution_product.is_active:
            continue
        merchant_sku = _normalize_upper_text(distribution_product.product.sku)
        if not merchant_sku or merchant_sku in metadata_by_sku:
            continue
        metadata_by_sku[merchant_sku] = {
            "merchantCode": _normalize_text(distribution_product.external_sku),
            "client": _build_client_payload(distribution_product.customer_account.code, client_name_by_code),
        }
    return metadata_by_sku


def _build_pending_receival_lookup(purchase_orders: list[PurchaseOrder]) -> dict[str, _MetricAggregate]:
    lookup: dict[str, _MetricAggregate] = {}
    for purchase_order in purchase_orders:
        if _is_cancelled_status(purchase_order.status) or _is_closed_status(purchase_order.status):
            continue
        customer_code = _normalize_upper_text(purchase_order.customer_code)
        for line in purchase_order.lines.all():
            if _is_cancelled_status(line.status) or _is_closed_status(line.status):
                continue
            pending_receival = _to_positive_difference(line.ordered_qty, line.received_qty)
            _accumulate_aggregate(lookup, purchase_order.warehouse.name, line.product.sku, customer_code, pending_receival)
    return lookup


def _build_order_allocated_lookup(sales_orders: list[SalesOrder]) -> dict[str, _MetricAggregate]:
    lookup: dict[str, _MetricAggregate] = {}
    for sales_order in sales_orders:
        if _is_cancelled_status(sales_order.status) or _is_closed_status(sales_order.status):
            continue
        customer_code = _normalize_upper_text(sales_order.customer_code)
        for line in sales_order.lines.all():
            if _is_cancelled_status(line.status) or _is_closed_status(line.status):
                continue
            _accumulate_aggregate(
                lookup,
                sales_order.warehouse.name,
                line.product.sku,
                customer_code,
                _decimal_to_number(line.allocated_qty),
            )
    return lookup


def _build_in_transit_lookup(putaway_tasks: list[PutawayTask]) -> dict[str, _MetricAggregate]:
    lookup: dict[str, _MetricAggregate] = {}
    for putaway_task in putaway_tasks:
        if _is_cancelled_status(putaway_task.status) or _is_closed_status(putaway_task.status):
            continue
        _accumulate_aggregate(
            lookup,
            putaway_task.warehouse.name,
            putaway_task.product.sku,
            "",
            _decimal_to_number(putaway_task.quantity),
        )
    return lookup


def _build_live_inventory_rows(balances: list[InventoryBalance]) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    for balance in balances:
        merchant_sku = _normalize_upper_text(balance.product.sku)
        warehouse_name = _normalize_text(balance.warehouse.name)
        key = _build_warehouse_sku_key(warehouse_name, merchant_sku)
        listing_time = balance.last_movement_at.date().isoformat() if balance.last_movement_at else ""
        shelf = _normalize_upper_text(balance.location.code)
        on_hand_qty = _decimal_to_number(balance.on_hand_qty)
        available_stock = _decimal_to_number(balance.available_qty)
        allocated_qty = _decimal_to_number(balance.allocated_qty)
        hold_qty = _decimal_to_number(balance.hold_qty)
        defective_qty = on_hand_qty if _is_defective_stock_status(balance.stock_status) else 0
        current = grouped.get(key)
        if current is None:
            grouped[key] = {
                "id": f"live:{balance.warehouse_id}:{merchant_sku}",
                "merchantSku": merchant_sku,
                "productName": _normalize_text(balance.product.name) or merchant_sku,
                "productBarcode": _normalize_text(balance.product.barcode),
                "productCategory": _normalize_text(balance.product.category),
                "productBrand": _normalize_text(balance.product.brand),
                "productDescription": _normalize_text(balance.product.description),
                "productTags": _unique_sorted([balance.product.category, balance.product.brand]),
                "clients": [],
                "shelf": shelf,
                "shelves": _unique_sorted([shelf]),
                "inTransit": 0,
                "pendingReceival": 0,
                "toList": 0 if defective_qty > 0 else hold_qty,
                "orderAllocated": allocated_qty,
                "availableStock": available_stock,
                "defectiveProducts": defective_qty,
                "totalInventory": on_hand_qty,
                "listingTime": listing_time,
                "actualLength": "",
                "actualWidth": "",
                "actualHeight": "",
                "actualWeight": "",
                "measurementUnit": _normalize_text(balance.product.unit_of_measure),
                "merchantCode": "",
                "customerCode": "",
                "warehouseName": warehouse_name,
                "stockStatus": _normalize_upper_text(balance.stock_status),
                "stockStatuses": _unique_sorted([balance.stock_status]),
                **_default_location_metadata(),
                "source": "live",
            }
            continue
        current["availableStock"] += available_stock
        current["orderAllocated"] += allocated_qty
        current["toList"] += 0 if defective_qty > 0 else hold_qty
        current["defectiveProducts"] += defective_qty
        current["totalInventory"] += on_hand_qty
        current["shelves"] = _unique_sorted([*current["shelves"], shelf])
        current["shelf"] = current["shelves"][0] if current["shelves"] else ""
        current["stockStatuses"] = _unique_sorted([*current["stockStatuses"], balance.stock_status])
        current["stockStatus"] = current["stockStatuses"][0] if len(current["stockStatuses"]) == 1 else "MIXED"
        if listing_time and (not current["listingTime"] or listing_time < current["listingTime"]):
            current["listingTime"] = listing_time
    return sorted(grouped.values(), key=cmp_to_key(_compare_inventory_rows))


def _normalize_imported_row(
    record: InventoryInformationImportRecord,
    products_by_sku: dict[str, Product],
    client_name_by_code: dict[str, str],
) -> dict[str, Any]:
    merchant_sku = _normalize_upper_text(record.merchant_sku)
    product = products_by_sku.get(merchant_sku)
    clients = _merge_clients(
        [],
        [
            client
            for client in [
                _build_client_payload(record.customer_code, client_name_by_code),
            ]
            if client is not None
        ],
    )
    available_stock = _decimal_to_number(record.available_stock)
    total_inventory = available_stock
    return {
        "id": f"imported:{record.id}",
        "merchantSku": merchant_sku,
        "productName": _normalize_text(record.product_name) or _normalize_text(getattr(product, "name", "")) or merchant_sku,
        "productBarcode": _normalize_text(getattr(product, "barcode", "")),
        "productCategory": _normalize_text(getattr(product, "category", "")),
        "productBrand": _normalize_text(getattr(product, "brand", "")),
        "productDescription": _normalize_text(getattr(product, "description", "")),
        "productTags": _unique_sorted([getattr(product, "category", ""), getattr(product, "brand", "")]),
        "merchantCode": _normalize_text(record.merchant_code),
        "customerCode": _normalize_upper_text(record.customer_code),
        "clients": clients,
        "shelf": _normalize_upper_text(record.shelf),
        "shelves": _unique_sorted([record.shelf]),
        "inTransit": 0,
        "pendingReceival": 0,
        "toList": 0,
        "orderAllocated": 0,
        "availableStock": available_stock,
        "defectiveProducts": total_inventory if _is_defective_stock_status(record.stock_status) else 0,
        "totalInventory": total_inventory,
        "listingTime": record.listing_time.isoformat(),
        "actualLength": _normalize_text(record.actual_length),
        "actualWidth": _normalize_text(record.actual_width),
        "actualHeight": _normalize_text(record.actual_height),
        "actualWeight": _normalize_text(record.actual_weight),
        "measurementUnit": _normalize_text(record.measurement_unit) or _normalize_text(getattr(product, "unit_of_measure", "")),
        "warehouseName": _normalize_text(record.warehouse.name if record.warehouse else ""),
        "stockStatus": _normalize_upper_text(record.stock_status),
        "stockStatuses": _unique_sorted([record.stock_status]),
        "zoneCode": "",
        "zoneCodes": [],
        "locationTypeCode": "",
        "locationTypeCodes": [],
        "areaKey": "unassigned",
        "areaLabel": _area_label("unassigned"),
        "source": "imported",
    }


def _build_imported_merchant_code_lookup(rows: list[dict[str, Any]]) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for row in rows:
        key = _build_warehouse_sku_key(row["warehouseName"], row["merchantSku"])
        merchant_code = _normalize_text(row["merchantCode"])
        if merchant_code and key not in lookup:
            lookup[key] = merchant_code
    return lookup


def _build_imported_clients_lookup(rows: list[dict[str, Any]], client_name_by_code: dict[str, str]) -> dict[str, list[dict[str, str]]]:
    lookup: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        key = _build_warehouse_sku_key(row["warehouseName"], row["merchantSku"])
        existing_clients = lookup.get(key, [])
        imported_clients = [
            client
            for client in (
                _build_client_payload(code, client_name_by_code)
                for code in _unique_sorted([row["customerCode"], *[client["code"] for client in row["clients"]]])
            )
            if client is not None
        ]
        lookup[key] = _merge_clients(existing_clients, imported_clients)
    return lookup


def _enrich_row(
    row: dict[str, Any],
    *,
    pending_receival_lookup: dict[str, _MetricAggregate],
    order_allocated_lookup: dict[str, _MetricAggregate],
    in_transit_lookup: dict[str, _MetricAggregate],
    imported_merchant_code_lookup: dict[str, str],
    imported_clients_lookup: dict[str, list[dict[str, str]]],
    distribution_metadata_by_sku: dict[str, dict[str, Any]],
    client_name_by_code: dict[str, str],
) -> dict[str, Any]:
    warehouse_sku_key = _build_warehouse_sku_key(row["warehouseName"], row["merchantSku"])
    explicit_customer_code = _normalize_upper_text(row["customerCode"])
    imported_merchant_code = imported_merchant_code_lookup.get(warehouse_sku_key, "")
    distribution_metadata = distribution_metadata_by_sku.get(_normalize_upper_text(row["merchantSku"]))
    imported_clients = imported_clients_lookup.get(warehouse_sku_key, [])
    pending_clients = [
        _build_client_payload(client_code, client_name_by_code)
        for client_code in sorted(pending_receival_lookup.get(warehouse_sku_key, _MetricAggregate()).client_codes)
    ]
    allocated_clients = [
        _build_client_payload(client_code, client_name_by_code)
        for client_code in sorted(order_allocated_lookup.get(warehouse_sku_key, _MetricAggregate()).client_codes)
    ]
    operational_clients = [client for client in [*pending_clients, *allocated_clients] if client is not None]
    merged_clients = _merge_clients(
        row["clients"],
        imported_clients,
        [distribution_metadata["client"]] if distribution_metadata and distribution_metadata.get("client") else [],
        operational_clients,
    )
    preferred_client = (
        (row["clients"][0] if row["clients"] else None)
        or (imported_clients[0] if imported_clients else None)
        or (distribution_metadata.get("client") if distribution_metadata else None)
        or (operational_clients[0] if operational_clients else None)
    )
    resolved_client = _resolve_primary_client(explicit_customer_code, preferred_client, merged_clients, client_name_by_code)
    resolved_customer_code = explicit_customer_code or (resolved_client["code"] if resolved_client else "")
    return {
        **row,
        "merchantCode": row["merchantCode"] or imported_merchant_code or (distribution_metadata or {}).get("merchantCode", ""),
        "customerCode": resolved_customer_code,
        "clients": [resolved_client] if resolved_client else [],
        "pendingReceival": _resolve_aggregate_quantity(
            pending_receival_lookup.get(warehouse_sku_key),
            resolved_customer_code,
            row["pendingReceival"],
        ),
        "orderAllocated": _resolve_aggregate_quantity(
            order_allocated_lookup.get(warehouse_sku_key),
            resolved_customer_code,
            0 if resolved_customer_code else row["orderAllocated"],
        ),
        "inTransit": _resolve_aggregate_quantity(
            in_transit_lookup.get(warehouse_sku_key),
            "",
            row["inTransit"],
        ),
    }


def _build_location_lookup(locations: list[Location]) -> dict[str, dict[str, Location]]:
    locations_by_warehouse_and_code: dict[str, Location] = {}
    unique_locations_by_code: dict[str, Location] = {}
    duplicate_codes: set[str] = set()
    for location in locations:
        normalized_code = _normalize_location_code(location.code)
        warehouse_key = _normalize_upper_text(location.warehouse.name)
        if normalized_code:
            if normalized_code in unique_locations_by_code:
                duplicate_codes.add(normalized_code)
            else:
                unique_locations_by_code[normalized_code] = location
        if normalized_code and warehouse_key:
            locations_by_warehouse_and_code[f"{warehouse_key}::{normalized_code}"] = location
    for duplicate_code in duplicate_codes:
        unique_locations_by_code.pop(duplicate_code, None)
    return {
        "scoped": locations_by_warehouse_and_code,
        "unique": unique_locations_by_code,
    }


def _find_location_match(warehouse_name: str, shelf: str, lookup: dict[str, dict[str, Location]]) -> Location | None:
    normalized_shelf = _normalize_location_code(shelf)
    if not normalized_shelf:
        return None
    warehouse_key = _normalize_upper_text(warehouse_name)
    if warehouse_key:
        warehouse_scoped = lookup["scoped"].get(f"{warehouse_key}::{normalized_shelf}")
        if warehouse_scoped is not None:
            return warehouse_scoped
    return lookup["unique"].get(normalized_shelf)


def _annotate_rows_with_location_metadata(rows: list[dict[str, Any]], locations: list[Location]) -> list[dict[str, Any]]:
    if not locations:
        return [{**row, **_default_location_metadata()} for row in rows]
    lookup = _build_location_lookup(locations)
    annotated_rows: list[dict[str, Any]] = []
    for row in rows:
        shelves = _unique_sorted([row["shelf"], *row["shelves"]])
        matched_locations = [
            location
            for location in (_find_location_match(row["warehouseName"], shelf, lookup) for shelf in shelves)
            if location is not None
        ]
        if not matched_locations:
            annotated_rows.append({**row, **_default_location_metadata()})
            continue
        zone_codes = _unique_sorted([location.zone.code for location in matched_locations])
        location_type_codes = _unique_sorted([location.location_type.code for location in matched_locations])
        primary_metadata = _resolve_area(zone_codes[0] if zone_codes else "", location_type_codes[0] if location_type_codes else "")
        annotated_rows.append(
            {
                **row,
                **primary_metadata,
                "zoneCode": zone_codes[0] if zone_codes else "",
                "zoneCodes": zone_codes,
                "locationTypeCode": location_type_codes[0] if location_type_codes else "",
                "locationTypeCodes": location_type_codes,
            }
        )
    return annotated_rows


def _primary_client_label(row: dict[str, Any]) -> str:
    clients = row["clients"]
    return clients[0]["label"] if clients else row["customerCode"]


def _compare_inventory_rows(left: dict[str, Any], right: dict[str, Any]) -> int:
    for left_value, right_value in (
        (left["merchantSku"], right["merchantSku"]),
        (left["warehouseName"], right["warehouseName"]),
        (_primary_client_label(left), _primary_client_label(right)),
        (left["productName"] or left["merchantSku"], right["productName"] or right["merchantSku"]),
    ):
        comparison = _compare_text(left_value, right_value)
        if comparison != 0:
            return comparison
    if left["source"] != right["source"]:
        return -1 if left["source"] == "imported" else 1
    return _compare_text(left["id"], right["id"])


def _compare_rows_for_sort(left: dict[str, Any], right: dict[str, Any], sort_key: str, direction: str) -> int:
    reader = _SORT_READERS.get(sort_key, _SORT_READERS["merchantSku"])
    left_value = reader(left)
    right_value = reader(right)
    if isinstance(left_value, (int, float)) and isinstance(right_value, (int, float)):
        primary_comparison = _compare_numbers(left_value, right_value)
    else:
        primary_comparison = _compare_text(left_value, right_value)
    if primary_comparison != 0:
        return primary_comparison if direction == "asc" else -primary_comparison
    return _compare_inventory_rows(left, right)


def _decode_multi_value(value: str) -> tuple[str, ...]:
    normalized_value = _normalize_text(value)
    if not normalized_value:
        return ()
    try:
        import json

        parsed = json.loads(normalized_value)
    except Exception:
        parsed = [part for part in normalized_value.split(",")]
    if not isinstance(parsed, list):
        return ()
    return tuple(_unique_sorted([_normalize_text(item) for item in parsed]))


def _tokenize_query(query: str) -> list[str]:
    tokens: list[str] = []
    current = []
    in_quotes = False
    for character in _normalize_text(query):
        if character == '"':
            in_quotes = not in_quotes
            continue
        if character.isspace() and not in_quotes:
            if current:
                tokens.append("".join(current))
                current = []
            continue
        current.append(character)
    if current:
        tokens.append("".join(current))
    return tokens


def _matches_contains(field_value: str, query_value: str) -> bool:
    return _normalize_text(query_value).casefold() in _normalize_text(field_value).casefold()


def _matches_exact(field_value: str, query_value: str) -> bool:
    return _normalize_upper_text(field_value) == _normalize_upper_text(query_value)


def _build_searchable_values(row: dict[str, Any]) -> list[str]:
    return _unique_sorted(
        [
            row["merchantSku"],
            row["productName"],
            row["productBarcode"],
            row["productCategory"],
            row["productBrand"],
            row["productDescription"],
            *row["productTags"],
            row["merchantCode"],
            row["customerCode"],
            *[value for client in row["clients"] for value in (client["code"], client["name"], client["label"])],
            row["warehouseName"],
            row["shelf"],
            *row["shelves"],
            row["zoneCode"],
            *row["zoneCodes"],
            row["locationTypeCode"],
            *row["locationTypeCodes"],
            row["listingTime"],
            row["actualLength"],
            row["actualWidth"],
            row["actualHeight"],
            row["actualWeight"],
            row["measurementUnit"],
            row["stockStatus"],
            *row["stockStatuses"],
            row["areaKey"],
            row["areaLabel"],
            row["source"],
            _numeric_field_value(row["inTransit"]),
            _numeric_field_value(row["pendingReceival"]),
            _numeric_field_value(row["toList"]),
            _numeric_field_value(row["orderAllocated"]),
            _numeric_field_value(row["availableStock"]),
            _numeric_field_value(row["defectiveProducts"]),
            _numeric_field_value(row["totalInventory"]),
        ]
    )


def matches_inventory_information_query(row: dict[str, Any], query: str) -> bool:
    tokens = _tokenize_query(query)
    if not tokens:
        return True
    for token in tokens:
        delimiter_index = token.find(":")
        if delimiter_index == -1:
            if not any(_matches_contains(field_value, token) for field_value in _build_searchable_values(row)):
                return False
            continue
        raw_field = token[:delimiter_index].lower()
        raw_value = token[delimiter_index + 1 :]
        if not raw_value:
            return False
        resolved_field = _QUERY_ALIAS_MAP.get(raw_field)
        if not resolved_field:
            return False
        definition = _QUERY_FIELD_DEFINITIONS[resolved_field]
        field_values = definition["reader"](row)
        matcher = _matches_exact if definition["match_mode"] == "exact" else _matches_contains
        if not any(matcher(field_value, raw_value) for field_value in field_values):
            return False
    return True


def list_inventory_information_import_identity_rows(
    *,
    organization: Organization,
    warehouse_id: int | None,
) -> list[dict[str, str]]:
    queryset = InventoryInformationImportRecord.objects.filter(organization=organization)
    if warehouse_id is None:
        queryset = queryset.filter(warehouse__isnull=True)
    else:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    return [
        {
            "merchant_sku": record.merchant_sku,
            "shelf": record.shelf,
            "merchant_code": record.merchant_code,
            "customer_code": record.customer_code,
        }
        for record in queryset
    ]


def persist_inventory_information_import_rows(
    *,
    organization: Organization,
    warehouse: Warehouse | None,
    rows: list[dict[str, str]],
    created_by: str,
) -> None:
    for row in rows:
        InventoryInformationImportRecord.objects.update_or_create(
            organization=organization,
            warehouse=warehouse,
            merchant_sku=row["merchant_sku"],
            defaults={
                "product_name": row["product_name"],
                "shelf": row["shelf"],
                "available_stock": _to_decimal(row["available_stock"]) or Decimal("0"),
                "listing_time": date.fromisoformat(row["listing_time"]),
                "actual_length": row["actual_length"],
                "actual_width": row["actual_width"],
                "actual_height": row["actual_height"],
                "actual_weight": row["actual_weight"],
                "measurement_unit": row["measurement_unit"],
                "merchant_code": row["merchant_code"],
                "customer_code": row["customer_code"],
                "stock_status": row["stock_status"],
                "created_by": created_by,
            },
        )


def list_inventory_information_rows(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    filters: InventoryInformationFilters | None = None,
    sort_key: str = "merchantSku",
    sort_direction: str = "asc",
) -> dict[str, Any]:
    resolved_filters = filters or InventoryInformationFilters()
    products = list(
        Product.objects.filter(organization=organization)
        .order_by("sku", "id")
    )
    products_by_sku = {_normalize_upper_text(product.sku): product for product in products}
    client_name_by_code = {
        _normalize_upper_text(account.code): _normalize_text(account.name)
        for account in CustomerAccount.objects.filter(organization=organization).order_by("name", "id")
    }
    balances_queryset = InventoryBalance.objects.select_related("warehouse", "location", "product").filter(organization=organization)
    imported_queryset = InventoryInformationImportRecord.objects.select_related("warehouse").filter(organization=organization)
    purchase_order_queryset = (
        PurchaseOrder.objects.select_related("warehouse")
        .prefetch_related("lines__product")
        .filter(organization=organization)
        .order_by("-create_time", "-id")
    )
    sales_order_queryset = (
        SalesOrder.objects.select_related("warehouse")
        .prefetch_related("lines__product")
        .filter(organization=organization)
        .order_by("-create_time", "-id")
    )
    putaway_task_queryset = (
        PutawayTask.objects.select_related("warehouse", "product")
        .filter(organization=organization)
        .order_by("status", "create_time", "id")
    )
    locations_queryset = (
        Location.objects.select_related("warehouse", "zone", "location_type")
        .filter(organization=organization)
        .order_by("warehouse__name", "pick_sequence", "code", "id")
    )
    distribution_products_queryset = (
        DistributionProduct.objects.select_related("product", "customer_account")
        .filter(product__organization=organization)
        .order_by("product__sku", "customer_account__code", "external_sku", "id")
    )
    if warehouse_id is not None:
        balances_queryset = balances_queryset.filter(warehouse_id=warehouse_id)
        imported_queryset = imported_queryset.filter(warehouse_id=warehouse_id)
        purchase_order_queryset = purchase_order_queryset.filter(warehouse_id=warehouse_id)
        sales_order_queryset = sales_order_queryset.filter(warehouse_id=warehouse_id)
        putaway_task_queryset = putaway_task_queryset.filter(warehouse_id=warehouse_id)
        locations_queryset = locations_queryset.filter(warehouse_id=warehouse_id)

    balances = list(balances_queryset)
    live_rows = _build_live_inventory_rows(balances)
    live_rows_by_warehouse_sku = {
        _build_warehouse_sku_key(row["warehouseName"], row["merchantSku"]): row
        for row in live_rows
    }
    imported_records = list(imported_queryset.order_by("merchant_sku", "shelf", "id"))
    normalized_imported_rows = [_normalize_imported_row(record, products_by_sku, client_name_by_code) for record in imported_records]
    imported_merchant_code_lookup = _build_imported_merchant_code_lookup(normalized_imported_rows)
    imported_clients_lookup = _build_imported_clients_lookup(normalized_imported_rows, client_name_by_code)
    distribution_metadata_by_sku = _build_distribution_metadata_by_sku(list(distribution_products_queryset), client_name_by_code)
    pending_receival_lookup = _build_pending_receival_lookup(list(purchase_order_queryset))
    order_allocated_lookup = _build_order_allocated_lookup(list(sales_order_queryset))
    in_transit_lookup = _build_in_transit_lookup(list(putaway_task_queryset))
    covered_live_keys = {
        _build_warehouse_sku_key(row["warehouseName"], row["merchantSku"])
        for row in normalized_imported_rows
        if _normalize_text(_build_warehouse_sku_key(row["warehouseName"], row["merchantSku"]))
    }
    enriched_imported_rows: list[dict[str, Any]] = []
    for row in normalized_imported_rows:
        live_match = live_rows_by_warehouse_sku.get(_build_warehouse_sku_key(row["warehouseName"], row["merchantSku"]))
        base_row = row
        if live_match is not None:
            base_row = {
                **row,
                "availableStock": live_match["availableStock"],
                "defectiveProducts": live_match["defectiveProducts"],
                "totalInventory": live_match["totalInventory"],
                "toList": live_match["toList"],
                "shelves": row["shelves"] or live_match["shelves"],
                "shelf": row["shelf"] or live_match["shelf"],
                "stockStatuses": row["stockStatuses"] or live_match["stockStatuses"],
                "stockStatus": row["stockStatus"] or live_match["stockStatus"],
                "listingTime": row["listingTime"] or live_match["listingTime"],
                "measurementUnit": row["measurementUnit"] or live_match["measurementUnit"],
            }
        enriched_imported_rows.append(
            _enrich_row(
                base_row,
                pending_receival_lookup=pending_receival_lookup,
                order_allocated_lookup=order_allocated_lookup,
                in_transit_lookup=in_transit_lookup,
                imported_merchant_code_lookup=imported_merchant_code_lookup,
                imported_clients_lookup=imported_clients_lookup,
                distribution_metadata_by_sku=distribution_metadata_by_sku,
                client_name_by_code=client_name_by_code,
            )
        )
    visible_live_rows = [
        _enrich_row(
            row,
            pending_receival_lookup=pending_receival_lookup,
            order_allocated_lookup=order_allocated_lookup,
            in_transit_lookup=in_transit_lookup,
            imported_merchant_code_lookup=imported_merchant_code_lookup,
            imported_clients_lookup=imported_clients_lookup,
            distribution_metadata_by_sku=distribution_metadata_by_sku,
            client_name_by_code=client_name_by_code,
        )
        for row in live_rows
        if _build_warehouse_sku_key(row["warehouseName"], row["merchantSku"]) not in covered_live_keys
    ]
    all_rows = _annotate_rows_with_location_metadata(
        sorted([*enriched_imported_rows, *visible_live_rows], key=cmp_to_key(_compare_inventory_rows)),
        list(locations_queryset),
    )
    filter_options = {
        "warehouses": [{"value": value, "label": value} for value in _unique_sorted([row["warehouseName"] for row in all_rows])],
        "tags": [{"value": value, "label": value} for value in _unique_sorted([tag for row in all_rows for tag in row["productTags"]])],
        "clients": sorted(
            {
                client["code"]: {"value": client["code"], "label": client["label"]}
                for row in all_rows
                for client in row["clients"]
            }.values(),
            key=lambda option: _natural_sort_key(option["label"]),
        ),
        "skus": [{"value": value, "label": value} for value in _unique_sorted([row["merchantSku"] for row in all_rows])],
    }
    selected_warehouse_values = set(resolved_filters.warehouses)
    selected_tag_values = set(resolved_filters.tags)
    selected_client_values = set(resolved_filters.clients)
    selected_sku_values = set(resolved_filters.merchant_skus)
    inventory_count_min = _to_decimal(resolved_filters.inventory_count_min)
    inventory_count_max = _to_decimal(resolved_filters.inventory_count_max)
    filtered_rows = []
    for row in all_rows:
        if resolved_filters.query and not matches_inventory_information_query(row, resolved_filters.query):
            continue
        if selected_warehouse_values and row["warehouseName"] not in selected_warehouse_values:
            continue
        if selected_tag_values and not any(tag in selected_tag_values for tag in row["productTags"]):
            continue
        if selected_sku_values and row["merchantSku"] not in selected_sku_values:
            continue
        if selected_client_values and not any(client["code"] in selected_client_values for client in row["clients"]):
            continue
        total_inventory = _to_decimal(row["totalInventory"]) or Decimal("0")
        if resolved_filters.hide_zero_stock and total_inventory <= 0:
            continue
        if inventory_count_min is not None and total_inventory < inventory_count_min:
            continue
        if inventory_count_max is not None and total_inventory > inventory_count_max:
            continue
        filtered_rows.append(row)
    sorted_rows = sorted(
        filtered_rows,
        key=cmp_to_key(lambda left, right: _compare_rows_for_sort(left, right, sort_key, sort_direction)),
    )
    return {
        "rows": sorted_rows,
        "filterOptions": filter_options,
    }


def build_inventory_information_filters(raw_filters: dict[str, str]) -> InventoryInformationFilters:
    return InventoryInformationFilters(
        query=_normalize_text(raw_filters.get("query", "")),
        warehouses=_decode_multi_value(raw_filters.get("warehouses", "")),
        tags=_decode_multi_value(raw_filters.get("tags", "")),
        clients=_decode_multi_value(raw_filters.get("clients", "")),
        merchant_skus=_decode_multi_value(raw_filters.get("merchantSkus", "")),
        inventory_count_min=_normalize_text(raw_filters.get("inventoryCountMin", "")),
        inventory_count_max=_normalize_text(raw_filters.get("inventoryCountMax", "")),
        hide_zero_stock=_normalize_boolean(raw_filters.get("hideZeroStock", "")),
    )
