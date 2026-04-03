from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from functools import cmp_to_key
import re
from typing import Any

from apps.common.operation_types import OperationOrderType
from django.db.models import Prefetch

from apps.inbound.models import PurchaseOrder, PutawayTask, ReceiptLine
from apps.inventory.models import InventoryMovement
from apps.organizations.models import Organization

_VALID_SEARCH_FIELDS = {
    "all",
    "merchantSku",
    "productName",
    "productBarcode",
    "referenceCode",
    "locationCode",
    "performedBy",
    "reason",
}
_VALID_MATCH_MODES = {"contains", "exact"}
_SEARCH_FIELD_ALIASES = {
    "sku": "merchantSku",
    "merchant sku": "merchantSku",
    "merchantsku": "merchantSku",
    "name": "productName",
    "product name": "productName",
    "barcode": "productBarcode",
    "reference": "referenceCode",
    "ref": "referenceCode",
    "location": "locationCode",
    "performed by": "performedBy",
    "performedby": "performedBy",
    "by": "performedBy",
    "user": "performedBy",
    "reason": "reason",
}
_SEARCH_PREFIX_PATTERN = re.compile(
    r"(?<!\S)(" + "|".join(re.escape(alias) for alias in sorted(_SEARCH_FIELD_ALIASES, key=len, reverse=True)) + r")\s*:",
    re.IGNORECASE,
)
_SORT_READERS = {
    "occurredAt": lambda row: row["occurredAt"],
    "merchantSku": lambda row: row["merchantSku"],
    "warehouseName": lambda row: row["warehouseName"],
    "movementType": lambda row: row["movementTypeLabel"],
    "quantity": lambda row: row["quantity"],
    "resultingQuantity": lambda row: row["resultingQuantity"] if row["resultingQuantity"] is not None else Decimal("-1"),
}
_INCREASE_MOVEMENT_TYPES = {"OPENING", "RECEIPT", "PUTAWAY", "TRANSFER", "ADJUSTMENT_IN", "RELEASE_HOLD"}
_DECREASE_MOVEMENT_TYPES = {"PICK", "SHIP", "ADJUSTMENT_OUT", "HOLD"}


@dataclass(frozen=True, slots=True)
class InventoryMovementHistoryFilters:
    query: str = ""
    warehouses: tuple[str, ...] = ()
    movement_types: tuple[str, ...] = ()
    date_from: str = ""
    date_to: str = ""
    quantity_min: str = ""
    quantity_max: str = ""
    merchant_sku: str = ""
    location_code: str = ""
    performed_by: str = ""
    reference_code: str = ""
    search_fields: tuple[str, ...] = ()
    match_mode: str = "contains"


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_upper_text(value: Any) -> str:
    return _normalize_text(value).upper()


def _decode_multi_value(value: str) -> tuple[str, ...]:
    normalized = _normalize_text(value)
    if not normalized:
        return ()
    if normalized.startswith("["):
        try:
            import json

            parsed = json.loads(normalized)
        except (TypeError, ValueError):
            return ()
        if not isinstance(parsed, list):
            return ()
        return tuple(sorted({_normalize_text(item) for item in parsed if _normalize_text(item)}, key=_natural_sort_key))
    return tuple(sorted({_normalize_text(item) for item in normalized.split(",") if _normalize_text(item)}, key=_natural_sort_key))


def _to_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _decimal_to_number(value: Any) -> int | float | None:
    decimal_value = _to_decimal(value)
    if decimal_value is None:
        return None
    return int(decimal_value) if decimal_value == decimal_value.to_integral() else float(decimal_value)


def _parse_date(value: str) -> date | None:
    normalized = _normalize_text(value)
    if not normalized:
        return None
    try:
        return date.fromisoformat(normalized)
    except ValueError:
        return None


def _natural_sort_key(value: Any) -> tuple[Any, ...]:
    parts = re.split(r"(\d+)", _normalize_text(value))
    return tuple((1, int(part)) if part.isdigit() else (0, part.casefold()) for part in parts if part)


def _compare_text(left: Any, right: Any) -> int:
    left_key = _natural_sort_key(left)
    right_key = _natural_sort_key(right)
    if left_key == right_key:
        return 0
    return -1 if left_key < right_key else 1


def _compare_numbers(left: int | float | Decimal, right: int | float | Decimal) -> int:
    if left == right:
        return 0
    return -1 if left < right else 1


def _format_status_label(value: str) -> str:
    return " ".join(segment.capitalize() for segment in _normalize_text(value).split("_") if segment)


def _build_search_values_for_field(row: dict[str, Any], search_field: str) -> list[str]:
    if search_field == "merchantSku":
        return [row["merchantSku"]]
    if search_field == "productName":
        return [row["productName"]]
    if search_field == "productBarcode":
        return [row["productBarcode"], row["serialNumber"], row["batchNumber"]]
    if search_field == "referenceCode":
        return [row["referenceCode"], row["purchaseOrderNumber"], row["receiptNumber"], row["asnNumber"], *[entry["value"] for entry in row["sourceDocumentNumbers"]]]
    if search_field == "locationCode":
        return [row["fromLocationCode"], row["toLocationCode"], row["resultingLocationCode"], row["shelfCode"]]
    if search_field == "performedBy":
        return [row["performedBy"]]
    if search_field == "reason":
        return [row["reason"]]
    return [
        row["merchantSku"],
        row["productName"],
        row["productBarcode"],
        row["clientCode"],
        row["clientName"],
        row["warehouseName"],
        row["movementTypeLabel"],
        row["referenceCode"],
        row["purchaseOrderNumber"],
        row["receiptNumber"],
        row["asnNumber"],
        row["batchNumber"],
        row["serialNumber"],
        row["reason"],
        row["performedBy"],
        row["fromLocationCode"],
        row["toLocationCode"],
        row["shelfCode"],
        row["resultingLocationCode"],
        *[entry["value"] for entry in row["linkedDocumentNumbers"]],
        *[entry["value"] for entry in row["sourceDocumentNumbers"]],
    ]


def _resolve_search_fields(search_fields: tuple[str, ...]) -> tuple[str, ...]:
    normalized_fields = tuple(field for field in search_fields if field in _VALID_SEARCH_FIELDS and field != "all")
    if not normalized_fields or "all" in search_fields:
        return ("all",)
    return normalized_fields


def _build_search_values(row: dict[str, Any], search_fields: tuple[str, ...]) -> list[str]:
    resolved_search_fields = _resolve_search_fields(search_fields)
    if resolved_search_fields == ("all",):
        return _build_search_values_for_field(row, "all")
    values: list[str] = []
    for search_field in resolved_search_fields:
        values.extend(_build_search_values_for_field(row, search_field))
    return values


def _parse_prefixed_query(query: str) -> tuple[list[tuple[str, str]], str]:
    matches = list(_SEARCH_PREFIX_PATTERN.finditer(query))
    if not matches:
        return [], _normalize_text(query)

    prefixed_terms: list[tuple[str, str]] = []
    free_text_parts: list[str] = []
    cursor = 0

    for index, match in enumerate(matches):
        prefix_start = match.start()
        if cursor < prefix_start:
            free_text_parts.append(query[cursor:prefix_start])
        value_start = match.end()
        next_start = matches[index + 1].start() if index + 1 < len(matches) else len(query)
        value = _normalize_text(query[value_start:next_start])
        field = _SEARCH_FIELD_ALIASES.get(match.group(1).casefold())
        if field and value:
            prefixed_terms.append((field, value))
        cursor = next_start

    free_text = _normalize_text(" ".join(part.strip() for part in free_text_parts if _normalize_text(part)))
    return prefixed_terms, free_text


def _matches_search_values(values: list[str], query: str, match_mode: str) -> bool:
    normalized_match_mode = match_mode if match_mode in _VALID_MATCH_MODES else "contains"
    if normalized_match_mode == "exact":
        return any(_normalize_upper_text(value) == _normalize_upper_text(query) for value in values)
    return any(query.casefold() in _normalize_text(value).casefold() for value in values)


def _matches_query(row: dict[str, Any], *, query: str, search_fields: tuple[str, ...], match_mode: str) -> bool:
    normalized_query = _normalize_text(query)
    if not normalized_query:
        return True
    normalized_search_fields = _resolve_search_fields(search_fields)
    prefixed_terms, remaining_query = _parse_prefixed_query(normalized_query)

    for field, field_query in prefixed_terms:
        if not _matches_search_values(_build_search_values(row, (field,)), field_query, match_mode):
            return False

    if remaining_query:
        return _matches_search_values(_build_search_values(row, normalized_search_fields), remaining_query, match_mode)

    return True


def _matches_field_filter(row: dict[str, Any], *, field: str, query: str, match_mode: str) -> bool:
    normalized_query = _normalize_text(query)
    if not normalized_query:
        return True
    return _matches_search_values(_build_search_values(row, (field,)), normalized_query, match_mode)


def _build_document_entry(label: str, value: Any) -> dict[str, str] | None:
    normalized_value = _normalize_text(value)
    if not normalized_value:
        return None
    return {"label": label, "value": normalized_value}


def _append_document_entry(entries: list[dict[str, str]], seen_values: set[tuple[str, str]], label: str, value: Any) -> None:
    entry = _build_document_entry(label, value)
    if entry is None:
        return
    key = (entry["label"], entry["value"])
    if key in seen_values:
        return
    seen_values.add(key)
    entries.append(entry)


def _resolve_movement_quantities(movement: InventoryMovement) -> tuple[int | float | None, int | float | None]:
    quantity = _decimal_to_number(movement.quantity) or 0
    resulting_to_qty = _decimal_to_number(movement.resulting_to_qty)
    resulting_from_qty = _decimal_to_number(movement.resulting_from_qty)
    if movement.to_location_id is not None and resulting_to_qty is not None:
        if movement.movement_type in _INCREASE_MOVEMENT_TYPES:
            return resulting_to_qty - quantity, resulting_to_qty
        return resulting_to_qty, resulting_to_qty
    if movement.from_location_id is not None and resulting_from_qty is not None:
        if movement.movement_type in _DECREASE_MOVEMENT_TYPES:
            return resulting_from_qty + quantity, resulting_from_qty
        return resulting_from_qty, resulting_from_qty
    fallback_quantity = resulting_to_qty if resulting_to_qty is not None else resulting_from_qty
    return fallback_quantity, fallback_quantity


def _resolve_entry_type_label(*, movement_type: str, purchase_order: PurchaseOrder | None) -> str:
    if movement_type != "RECEIPT" or purchase_order is None:
        return _format_status_label(movement_type)
    if purchase_order.order_type == OperationOrderType.B2B:
        return "B2B Stock-in"
    return "Standard Stock-in"


def _serialize_inventory_movement(movement: InventoryMovement) -> dict[str, Any]:
    receipt_line = next(iter(movement.receipt_lines.all()), None)
    putaway_task = next(iter(receipt_line.putaway_tasks.all()), None) if receipt_line is not None else None
    if putaway_task is None:
        putaway_task = next(iter(movement.putaway_tasks.all()), None)
    if receipt_line is None and putaway_task is not None:
        receipt_line = putaway_task.receipt_line
    receipt = receipt_line.receipt if receipt_line is not None else None
    purchase_order = receipt.purchase_order if receipt is not None else None
    asn = receipt.asn if receipt is not None else None
    resulting_from_qty = _decimal_to_number(movement.resulting_from_qty)
    resulting_to_qty = _decimal_to_number(movement.resulting_to_qty)
    resulting_location_code = (
        movement.to_location.code
        if movement.to_location_id is not None
        else movement.from_location.code
        if movement.from_location_id is not None
        else ""
    )
    quantity_before_change, remaining_batch_quantity = _resolve_movement_quantities(movement)
    linked_document_numbers: list[dict[str, str]] = []
    linked_document_seen: set[tuple[str, str]] = set()
    source_document_numbers: list[dict[str, str]] = []
    source_document_seen: set[tuple[str, str]] = set()
    _append_document_entry(
        linked_document_numbers,
        linked_document_seen,
        "Stock-in No.",
        receipt.receipt_number if receipt is not None else movement.reference_code,
    )
    _append_document_entry(
        linked_document_numbers,
        linked_document_seen,
        "Receiving Serial Number",
        movement.serial_number or (receipt.reference_code if receipt is not None else ""),
    )
    _append_document_entry(
        linked_document_numbers,
        linked_document_seen,
        "Listing Serial Number",
        putaway_task.task_number if putaway_task is not None else "",
    )
    _append_document_entry(source_document_numbers, source_document_seen, "Purchase Order", purchase_order.po_number if purchase_order is not None else "")
    _append_document_entry(source_document_numbers, source_document_seen, "ASN", asn.asn_number if asn is not None else "")
    _append_document_entry(source_document_numbers, source_document_seen, "Reference", receipt.reference_code if receipt is not None else movement.reference_code)
    source_document_number = (
        _normalize_text(movement.reference_code)
        or (receipt.receipt_number if receipt is not None else "")
        or (purchase_order.po_number if purchase_order is not None else "")
        or (asn.asn_number if asn is not None else "")
    )
    return {
        "id": movement.id,
        "warehouseId": movement.warehouse_id,
        "warehouseName": movement.warehouse.name,
        "productId": movement.product_id,
        "merchantSku": movement.product.sku,
        "productName": movement.product.name,
        "productBarcode": movement.product.barcode,
        "clientCode": purchase_order.customer_code if purchase_order is not None else "",
        "clientName": purchase_order.customer_name if purchase_order is not None else "",
        "movementType": movement.movement_type,
        "movementTypeLabel": _format_status_label(movement.movement_type),
        "entryTypeLabel": _resolve_entry_type_label(movement_type=movement.movement_type, purchase_order=purchase_order),
        "stockStatus": movement.stock_status,
        "quantity": _decimal_to_number(movement.quantity) or 0,
        "fromLocationCode": movement.from_location.code if movement.from_location_id is not None else "",
        "toLocationCode": movement.to_location.code if movement.to_location_id is not None else "",
        "referenceCode": movement.reference_code,
        "sourceDocumentNumber": source_document_number,
        "linkedDocumentNumbers": linked_document_numbers,
        "sourceDocumentNumbers": source_document_numbers,
        "purchaseOrderNumber": purchase_order.po_number if purchase_order is not None else "",
        "receiptNumber": receipt.receipt_number if receipt is not None else "",
        "asnNumber": asn.asn_number if asn is not None else "",
        "batchNumber": movement.lot_number,
        "serialNumber": movement.serial_number,
        "shelfCode": resulting_location_code,
        "quantityBeforeChange": quantity_before_change,
        "remainingBatchQuantity": remaining_batch_quantity,
        "reason": movement.reason,
        "performedBy": movement.performed_by,
        "occurredAt": movement.occurred_at.isoformat(),
        "occurredDate": movement.occurred_at.date().isoformat(),
        "resultingFromQty": resulting_from_qty,
        "resultingToQty": resulting_to_qty,
        "resultingQuantity": resulting_to_qty if resulting_to_qty is not None else resulting_from_qty,
        "resultingLocationCode": resulting_location_code,
    }


def _compare_rows_for_sort(left: dict[str, Any], right: dict[str, Any], sort_key: str, sort_direction: str) -> int:
    reader = _SORT_READERS.get(sort_key, _SORT_READERS["occurredAt"])
    left_value = reader(left)
    right_value = reader(right)
    if isinstance(left_value, (int, float, Decimal)) and isinstance(right_value, (int, float, Decimal)):
        comparison = _compare_numbers(left_value, right_value)
    else:
        comparison = _compare_text(left_value, right_value)
    if comparison != 0:
        return comparison if sort_direction == "asc" else -comparison
    fallback = _compare_text(left["occurredAt"], right["occurredAt"])
    if fallback != 0:
        return fallback if sort_direction == "asc" else -fallback
    return _compare_numbers(left["id"], right["id"]) if sort_direction == "asc" else -_compare_numbers(left["id"], right["id"])


def list_inventory_movement_history_rows(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    filters: InventoryMovementHistoryFilters | None = None,
    sort_key: str = "occurredAt",
    sort_direction: str = "desc",
) -> dict[str, Any]:
    resolved_filters = filters or InventoryMovementHistoryFilters()
    queryset = (
        InventoryMovement.objects.select_related(
            "warehouse",
            "product",
            "from_location",
            "to_location",
        )
        .prefetch_related(
            Prefetch(
                "receipt_lines",
                queryset=ReceiptLine.objects.select_related(
                    "receipt",
                    "receipt__purchase_order",
                    "receipt__asn",
                ).prefetch_related(
                    Prefetch(
                        "putaway_tasks",
                        queryset=PutawayTask.objects.select_related(
                            "receipt_line",
                            "receipt_line__receipt",
                            "receipt_line__receipt__purchase_order",
                            "receipt_line__receipt__asn",
                        ).order_by("id"),
                    )
                ).order_by("id"),
            ),
            Prefetch(
                "putaway_tasks",
                queryset=PutawayTask.objects.select_related(
                    "receipt_line",
                    "receipt_line__receipt",
                    "receipt_line__receipt__purchase_order",
                    "receipt_line__receipt__asn",
                ).order_by("id"),
            ),
        )
        .filter(organization=organization)
    )
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    all_rows = [_serialize_inventory_movement(movement) for movement in queryset.order_by("-occurred_at", "-id")]
    warehouse_options_by_id = {
        row["warehouseId"]: {"value": str(row["warehouseId"]), "label": row["warehouseName"]}
        for row in all_rows
    }
    filter_options = {
        "warehouses": sorted(warehouse_options_by_id.values(), key=lambda option: _natural_sort_key(option["label"])),
        "movementTypes": [
            {"value": movement_type, "label": _format_status_label(movement_type)}
            for movement_type in sorted({_normalize_text(row["movementType"]) for row in all_rows if _normalize_text(row["movementType"])}, key=_natural_sort_key)
        ],
    }
    selected_warehouse_values = set(resolved_filters.warehouses)
    selected_movement_types = set(resolved_filters.movement_types)
    date_from = _parse_date(resolved_filters.date_from)
    date_to = _parse_date(resolved_filters.date_to)
    quantity_min = _to_decimal(resolved_filters.quantity_min)
    quantity_max = _to_decimal(resolved_filters.quantity_max)
    filtered_rows: list[dict[str, Any]] = []
    for row in all_rows:
        if selected_warehouse_values and str(row["warehouseId"]) not in selected_warehouse_values:
            continue
        if selected_movement_types and row["movementType"] not in selected_movement_types:
            continue
        row_date = _parse_date(row["occurredDate"])
        if date_from is not None and row_date is not None and row_date < date_from:
            continue
        if date_to is not None and row_date is not None and row_date > date_to:
            continue
        quantity = _to_decimal(row["quantity"]) or Decimal("0")
        if quantity_min is not None and quantity < quantity_min:
            continue
        if quantity_max is not None and quantity > quantity_max:
            continue
        if not _matches_field_filter(
            row,
            field="merchantSku",
            query=resolved_filters.merchant_sku,
            match_mode=resolved_filters.match_mode,
        ):
            continue
        if not _matches_field_filter(
            row,
            field="locationCode",
            query=resolved_filters.location_code,
            match_mode=resolved_filters.match_mode,
        ):
            continue
        if not _matches_field_filter(
            row,
            field="performedBy",
            query=resolved_filters.performed_by,
            match_mode=resolved_filters.match_mode,
        ):
            continue
        if not _matches_field_filter(
            row,
            field="referenceCode",
            query=resolved_filters.reference_code,
            match_mode=resolved_filters.match_mode,
        ):
            continue
        if not _matches_query(
            row,
            query=resolved_filters.query,
            search_fields=resolved_filters.search_fields,
            match_mode=resolved_filters.match_mode,
        ):
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


def build_inventory_movement_history_filters(raw_filters: dict[str, str]) -> InventoryMovementHistoryFilters:
    match_mode = _normalize_text(raw_filters.get("matchMode", "")) or "contains"
    search_fields = _decode_multi_value(raw_filters.get("searchFields", ""))
    if not search_fields:
        legacy_search_field = _normalize_text(raw_filters.get("searchField", ""))
        if legacy_search_field:
            search_fields = (legacy_search_field,)
    return InventoryMovementHistoryFilters(
        query=_normalize_text(raw_filters.get("query", "")),
        warehouses=_decode_multi_value(raw_filters.get("warehouses", "")),
        movement_types=_decode_multi_value(raw_filters.get("movementTypes", "")),
        date_from=_normalize_text(raw_filters.get("dateFrom", "")),
        date_to=_normalize_text(raw_filters.get("dateTo", "")),
        quantity_min=_normalize_text(raw_filters.get("quantityMin", "")),
        quantity_max=_normalize_text(raw_filters.get("quantityMax", "")),
        merchant_sku=_normalize_text(raw_filters.get("merchantSku", "")),
        location_code=_normalize_text(raw_filters.get("locationCode", "")),
        performed_by=_normalize_text(raw_filters.get("performedBy", "")),
        reference_code=_normalize_text(raw_filters.get("referenceCode", "")),
        search_fields=_resolve_search_fields(search_fields),
        match_mode=match_mode if match_mode in _VALID_MATCH_MODES else "contains",
    )
