from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.db.models.functions import Coalesce, TruncDate, TruncHour
from django.utils import timezone

from apps.common.operation_types import OperationOrderType
from apps.counting.models import CountApproval, CountApprovalStatus
from apps.inbound.models import PurchaseOrder, PurchaseOrderStatus, PutawayTask, PutawayTaskStatus, Receipt, ReceiptLine
from apps.inventory.models import InventoryBalance
from apps.organizations.models import Organization
from apps.outbound.models import PickTask, PickTaskStatus, SalesOrder, SalesOrderStatus, Shipment
from apps.reporting.models import (
    OperationalReportExport,
    OperationalReportStatus,
    OperationalReportType,
    WarehouseKpiSnapshot,
)
from apps.returns.models import ReturnOrder, ReturnOrderStatus
from apps.warehouse.models import Warehouse

ZERO = Decimal("0.0000")


@dataclass(frozen=True, slots=True)
class KpiSnapshotInput:
    organization: Organization
    warehouse: Warehouse
    snapshot_date: date


@dataclass(frozen=True, slots=True)
class OperationalReportInput:
    organization: Organization
    report_type: str
    warehouse: Warehouse | None = None
    date_from: date | None = None
    date_to: date | None = None
    parameters: dict[str, object] | None = None


@dataclass(frozen=True, slots=True)
class ParsedTemporalBoundary:
    filter_at: datetime
    bucket_at: datetime
    display_value: str
    has_time: bool


@dataclass(frozen=True, slots=True)
class DashboardTimeRange:
    time_window: str
    date_from: str
    date_to: str
    filter_from: datetime
    filter_to: datetime
    bucket_start: datetime
    bucket_end: datetime
    bucket_mode: str


def _parse_iso_temporal_boundary(value: str | None, *, is_end: bool) -> ParsedTemporalBoundary | None:
    if value is None:
        return None

    candidate = value.strip()
    if not candidate:
        return None

    current_timezone = timezone.get_current_timezone()
    if "T" not in candidate and " " not in candidate:
        try:
            parsed_date = date.fromisoformat(candidate)
        except ValueError:
            return None

        bucket_at = timezone.make_aware(datetime.combine(parsed_date, time.min), current_timezone)
        filter_at = timezone.make_aware(
            datetime.combine(parsed_date, time.max if is_end else time.min),
            current_timezone,
        )
        return ParsedTemporalBoundary(
            filter_at=filter_at,
            bucket_at=bucket_at,
            display_value=parsed_date.isoformat(),
            has_time=False,
        )

    try:
        parsed_datetime = datetime.fromisoformat(candidate.replace(" ", "T").replace("Z", "+00:00"))
    except ValueError:
        return None

    localized_datetime = (
        timezone.make_aware(parsed_datetime, current_timezone)
        if timezone.is_naive(parsed_datetime)
        else timezone.localtime(parsed_datetime, current_timezone)
    )
    bucket_at = localized_datetime.replace(minute=0, second=0, microsecond=0)
    filter_at = bucket_at + timedelta(hours=1) - timedelta(microseconds=1) if is_end else bucket_at
    return ParsedTemporalBoundary(
        filter_at=filter_at,
        bucket_at=bucket_at,
        display_value=bucket_at.replace(tzinfo=None).isoformat(timespec="minutes"),
        has_time=True,
    )


def resolve_dashboard_time_window(
    time_window: str | None,
    *,
    date_from_value: str | None = None,
    date_to_value: str | None = None,
) -> DashboardTimeRange:
    normalized = (time_window or "WEEK").strip().upper()
    today = timezone.localdate()
    now = timezone.localtime()
    current_timezone = timezone.get_current_timezone()

    if normalized == "CUSTOM":
        parsed_from = _parse_iso_temporal_boundary(date_from_value, is_end=False)
        parsed_to = _parse_iso_temporal_boundary(date_to_value, is_end=True)
        if parsed_from is not None and parsed_to is not None:
            start_boundary = parsed_from
            end_boundary = parsed_to
            if start_boundary.filter_at > end_boundary.filter_at:
                start_boundary, end_boundary = end_boundary, start_boundary

            has_hour_specific_range = start_boundary.has_time or end_boundary.has_time
            use_hour_buckets = has_hour_specific_range and (end_boundary.bucket_at - start_boundary.bucket_at) <= timedelta(days=3)
            if use_hour_buckets:
                bucket_start = start_boundary.bucket_at
                bucket_end = end_boundary.bucket_at
                bucket_mode = "hour"
            else:
                bucket_start = timezone.make_aware(
                    datetime.combine(start_boundary.bucket_at.date(), time.min),
                    current_timezone,
                )
                bucket_end = timezone.make_aware(
                    datetime.combine(end_boundary.bucket_at.date(), time.min),
                    current_timezone,
                )
                bucket_mode = "day"

            return DashboardTimeRange(
                time_window=normalized,
                date_from=start_boundary.display_value,
                date_to=end_boundary.display_value,
                filter_from=start_boundary.filter_at,
                filter_to=end_boundary.filter_at,
                bucket_start=bucket_start,
                bucket_end=bucket_end,
                bucket_mode=bucket_mode,
            )

    if normalized == "MONTH":
        range_start = today.replace(day=1)
    elif normalized == "YEAR":
        range_start = today.replace(month=1, day=1)
    else:
        normalized = "WEEK"
        range_start = today - timedelta(days=today.weekday())

    range_start_at = timezone.make_aware(datetime.combine(range_start, time.min), current_timezone)
    range_end_hour = now.replace(minute=0, second=0, microsecond=0)

    return DashboardTimeRange(
        time_window=normalized,
        date_from=range_start_at.replace(tzinfo=None).isoformat(timespec="minutes"),
        date_to=range_end_hour.replace(tzinfo=None).isoformat(timespec="minutes"),
        filter_from=range_start_at,
        filter_to=range_end_hour + timedelta(hours=1) - timedelta(microseconds=1),
        bucket_start=range_start_at,
        bucket_end=timezone.make_aware(datetime.combine(today, time.min), current_timezone),
        bucket_mode="day",
    )


def build_dashboard_order_statistics(
    *,
    organization: Organization,
    warehouse: Warehouse | None = None,
    time_window: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, object]:
    resolved_range = resolve_dashboard_time_window(
        time_window,
        date_from_value=date_from,
        date_to_value=date_to,
    )
    current_timezone = timezone.get_current_timezone()

    dropshipping_queryset = SalesOrder.objects.filter(
        organization=organization,
        order_type=OperationOrderType.DROPSHIP,
        create_time__gte=resolved_range.filter_from,
        create_time__lte=resolved_range.filter_to,
    )
    if warehouse is not None:
        dropshipping_queryset = dropshipping_queryset.filter(warehouse=warehouse)

    if resolved_range.bucket_mode == "hour":
        dropshipping_by_bucket = {
            timezone.localtime(row["bucket"], current_timezone).replace(minute=0, second=0, microsecond=0).replace(tzinfo=None).isoformat(timespec="minutes"): int(row["total_orders"])
            for row in dropshipping_queryset.annotate(bucket=TruncHour("create_time", tzinfo=current_timezone))
            .values("bucket")
            .annotate(total_orders=Count("id"))
            .order_by("bucket")
            if row["bucket"] is not None
        }
    else:
        dropshipping_by_bucket = {
            row["bucket"]: int(row["total_orders"])
            for row in dropshipping_queryset.annotate(bucket=TruncDate("create_time", tzinfo=current_timezone))
            .values("bucket")
            .annotate(total_orders=Count("id"))
            .order_by("bucket")
            if row["bucket"] is not None
        }

    stock_in_queryset = ReceiptLine.objects.filter(
        organization=organization,
        receipt__purchase_order__order_type=OperationOrderType.STANDARD,
        receipt__received_at__gte=resolved_range.filter_from,
        receipt__received_at__lte=resolved_range.filter_to,
    )
    if warehouse is not None:
        stock_in_queryset = stock_in_queryset.filter(receipt__warehouse=warehouse)

    if resolved_range.bucket_mode == "hour":
        stock_in_by_bucket = {
            timezone.localtime(row["bucket"], current_timezone).replace(minute=0, second=0, microsecond=0).replace(tzinfo=None).isoformat(timespec="minutes"): row["total_quantity"] or ZERO
            for row in stock_in_queryset.annotate(bucket=TruncHour("receipt__received_at", tzinfo=current_timezone))
            .values("bucket")
            .annotate(
                total_quantity=Coalesce(
                    Sum("received_qty"),
                    ZERO,
                    output_field=DecimalField(max_digits=18, decimal_places=4),
                )
            )
            .order_by("bucket")
            if row["bucket"] is not None
        }
    else:
        stock_in_by_bucket = {
            row["bucket"]: row["total_quantity"] or ZERO
            for row in stock_in_queryset.annotate(bucket=TruncDate("receipt__received_at", tzinfo=current_timezone))
            .values("bucket")
            .annotate(
                total_quantity=Coalesce(
                    Sum("received_qty"),
                    ZERO,
                    output_field=DecimalField(max_digits=18, decimal_places=4),
                )
            )
            .order_by("bucket")
            if row["bucket"] is not None
        }

    buckets: list[dict[str, object]] = []
    total_dropshipping_orders = 0
    total_stock_in_quantity = ZERO
    if resolved_range.bucket_mode == "hour":
        current_bucket = resolved_range.bucket_start
        while current_bucket <= resolved_range.bucket_end:
            current_bucket_key = current_bucket.replace(tzinfo=None).isoformat(timespec="minutes")
            dropshipping_orders = dropshipping_by_bucket.get(current_bucket_key, 0)
            stock_in_quantity = stock_in_by_bucket.get(current_bucket_key, ZERO)
            total_dropshipping_orders += dropshipping_orders
            total_stock_in_quantity += stock_in_quantity
            buckets.append(
                {
                    "date": current_bucket_key,
                    "dropshipping_orders": dropshipping_orders,
                    "stock_in_quantity": float(stock_in_quantity),
                }
            )
            current_bucket += timedelta(hours=1)
    else:
        current_date = resolved_range.bucket_start.date()
        end_date = resolved_range.bucket_end.date()
        while current_date <= end_date:
            dropshipping_orders = dropshipping_by_bucket.get(current_date, 0)
            stock_in_quantity = stock_in_by_bucket.get(current_date, ZERO)
            total_dropshipping_orders += dropshipping_orders
            total_stock_in_quantity += stock_in_quantity
            buckets.append(
                {
                    "date": current_date.isoformat(),
                    "dropshipping_orders": dropshipping_orders,
                    "stock_in_quantity": float(stock_in_quantity),
                }
            )
            current_date += timedelta(days=1)

    return {
        "time_window": resolved_range.time_window,
        "date_from": resolved_range.date_from,
        "date_to": resolved_range.date_to,
        "summary": {
            "dropshipping_orders": total_dropshipping_orders,
            "stock_in_quantity": float(total_stock_in_quantity),
        },
        "buckets": buckets,
    }


def list_kpi_snapshots(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    snapshot_date: date | None = None,
) -> list[WarehouseKpiSnapshot]:
    queryset = WarehouseKpiSnapshot.objects.select_related("warehouse").filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if snapshot_date is not None:
        queryset = queryset.filter(snapshot_date=snapshot_date)
    return list(queryset.order_by("-snapshot_date", "-id"))


def list_operational_report_exports(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    report_type: str | None = None,
) -> list[OperationalReportExport]:
    queryset = OperationalReportExport.objects.select_related("warehouse").filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if report_type is not None:
        queryset = queryset.filter(report_type=report_type)
    return list(queryset.order_by("-generated_at", "-id"))


def _balance_totals(*, organization: Organization, warehouse: Warehouse) -> dict[str, Decimal]:
    available_expr = ExpressionWrapper(
        F("on_hand_qty") - F("allocated_qty") - F("hold_qty"),
        output_field=DecimalField(max_digits=18, decimal_places=4),
    )
    totals = InventoryBalance.objects.filter(
        organization=organization,
        warehouse=warehouse,
    ).aggregate(
        on_hand_total=Sum("on_hand_qty"),
        allocated_total=Sum("allocated_qty"),
        hold_total=Sum("hold_qty"),
        available_total=Sum(available_expr),
    )
    return {
        "on_hand_qty": totals["on_hand_total"] or ZERO,
        "allocated_qty": totals["allocated_total"] or ZERO,
        "hold_qty": totals["hold_total"] or ZERO,
        "available_qty": totals["available_total"] or ZERO,
    }


@transaction.atomic
def generate_warehouse_kpi_snapshot(
    *,
    payload: KpiSnapshotInput,
    operator_name: str,
) -> WarehouseKpiSnapshot:
    totals = _balance_totals(organization=payload.organization, warehouse=payload.warehouse)
    snapshot, _ = WarehouseKpiSnapshot.objects.update_or_create(
        organization=payload.organization,
        warehouse=payload.warehouse,
        snapshot_date=payload.snapshot_date,
        defaults={
            "generated_at": timezone.now(),
            "generated_by": operator_name.strip() or "system",
            "on_hand_qty": totals["on_hand_qty"],
            "available_qty": totals["available_qty"],
            "allocated_qty": totals["allocated_qty"],
            "hold_qty": totals["hold_qty"],
            "open_purchase_orders": PurchaseOrder.objects.filter(
                organization=payload.organization,
                warehouse=payload.warehouse,
                status__in=(PurchaseOrderStatus.OPEN, PurchaseOrderStatus.PARTIAL),
            ).count(),
            "open_sales_orders": SalesOrder.objects.filter(
                organization=payload.organization,
                warehouse=payload.warehouse,
                status__in=(
                    SalesOrderStatus.OPEN,
                    SalesOrderStatus.ALLOCATED,
                    SalesOrderStatus.PICKING,
                    SalesOrderStatus.PICKED,
                ),
            ).count(),
            "open_putaway_tasks": PutawayTask.objects.filter(
                organization=payload.organization,
                warehouse=payload.warehouse,
                status__in=(PutawayTaskStatus.OPEN, PutawayTaskStatus.ASSIGNED),
            ).count(),
            "open_pick_tasks": PickTask.objects.filter(
                organization=payload.organization,
                warehouse=payload.warehouse,
                status__in=(PickTaskStatus.OPEN, PickTaskStatus.ASSIGNED),
            ).count(),
            "pending_count_approvals": CountApproval.objects.filter(
                organization=payload.organization,
                cycle_count_line__cycle_count__warehouse=payload.warehouse,
                status=CountApprovalStatus.PENDING,
            ).count(),
            "pending_return_orders": ReturnOrder.objects.filter(
                organization=payload.organization,
                warehouse=payload.warehouse,
                status__in=(
                    ReturnOrderStatus.OPEN,
                    ReturnOrderStatus.PARTIAL_RECEIVED,
                    ReturnOrderStatus.RECEIVED,
                    ReturnOrderStatus.PARTIAL_DISPOSED,
                ),
            ).count(),
        },
    )
    return snapshot


def _inventory_aging_rows(
    *,
    organization: Organization,
    warehouse: Warehouse | None,
    as_of: date,
) -> list[dict[str, object]]:
    queryset = InventoryBalance.objects.select_related(
        "warehouse",
        "location",
        "product",
    ).filter(organization=organization)
    if warehouse is not None:
        queryset = queryset.filter(warehouse=warehouse)
    rows: list[dict[str, object]] = []
    for balance in queryset.order_by("warehouse__name", "location__code", "product__sku", "id"):
        last_activity_at = balance.last_movement_at or timezone.now()
        age_days = max((as_of - last_activity_at.date()).days, 0)
        rows.append(
            {
                "warehouse_name": balance.warehouse.name,
                "warehouse_code": balance.warehouse.code,
                "location_code": balance.location.code,
                "product_sku": balance.product.sku,
                "stock_status": balance.stock_status,
                "on_hand_qty": str(balance.on_hand_qty),
                "available_qty": str(balance.available_qty),
                "allocated_qty": str(balance.allocated_qty),
                "hold_qty": str(balance.hold_qty),
                "age_days": age_days,
                "last_activity": last_activity_at.date().isoformat(),
            }
        )
    return rows


def _receiving_throughput_rows(
    *,
    organization: Organization,
    warehouse: Warehouse | None,
    date_from: date | None,
    date_to: date | None,
) -> list[dict[str, object]]:
    queryset = Receipt.objects.select_related(
        "warehouse",
    ).prefetch_related("lines").filter(organization=organization)
    if warehouse is not None:
        queryset = queryset.filter(warehouse=warehouse)
    if date_from is not None:
        queryset = queryset.filter(received_at__date__gte=date_from)
    if date_to is not None:
        queryset = queryset.filter(received_at__date__lte=date_to)
    rows: list[dict[str, object]] = []
    for receipt in queryset.order_by("received_at", "id"):
        lines = list(receipt.lines.all())
        total_qty = sum((line.received_qty for line in lines), ZERO)
        rows.append(
            {
                "receipt_number": receipt.receipt_number,
                "warehouse_name": receipt.warehouse.name,
                "warehouse_code": receipt.warehouse.code,
                "received_at": receipt.received_at.isoformat(),
                "line_count": len(lines),
                "total_qty": str(total_qty),
                "received_by": receipt.received_by,
            }
        )
    return rows


def _shipping_throughput_rows(
    *,
    organization: Organization,
    warehouse: Warehouse | None,
    date_from: date | None,
    date_to: date | None,
) -> list[dict[str, object]]:
    queryset = Shipment.objects.select_related(
        "warehouse",
        "sales_order",
        "sales_order__customer_account",
    ).prefetch_related("lines").filter(organization=organization)
    if warehouse is not None:
        queryset = queryset.filter(warehouse=warehouse)
    if date_from is not None:
        queryset = queryset.filter(shipped_at__date__gte=date_from)
    if date_to is not None:
        queryset = queryset.filter(shipped_at__date__lte=date_to)
    rows: list[dict[str, object]] = []
    for shipment in queryset.order_by("shipped_at", "id"):
        lines = list(shipment.lines.all())
        total_qty = sum((line.quantity for line in lines), ZERO)
        order = shipment.sales_order
        customer_name = order.customer_name or order.customer_account.name
        rows.append(
            {
                "shipment_number": shipment.shipment_number,
                "warehouse_name": shipment.warehouse.name,
                "warehouse_code": shipment.warehouse.code,
                "customer_name": customer_name,
                "shipped_at": shipment.shipped_at.isoformat(),
                "line_count": len(lines),
                "total_qty": str(total_qty),
                "shipped_by": shipment.shipped_by,
            }
        )
    return rows


def _rows_to_csv(rows: list[dict[str, object]], headers: list[str]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=headers)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue()


@transaction.atomic
def generate_operational_report(
    *,
    payload: OperationalReportInput,
    operator_name: str,
) -> OperationalReportExport:
    if payload.warehouse is not None and payload.warehouse.organization_id != payload.organization.id:
        raise ValidationError({"warehouse": "Warehouse must belong to the same organization as the report export."})
    if payload.date_from is not None and payload.date_to is not None and payload.date_from > payload.date_to:
        raise ValidationError({"date_from": "date_from cannot be after date_to."})

    if payload.report_type == OperationalReportType.INVENTORY_AGING:
        rows = _inventory_aging_rows(
            organization=payload.organization,
            warehouse=payload.warehouse,
            as_of=payload.date_to or payload.date_from or timezone.now().date(),
        )
        headers = [
            "warehouse_name",
            "warehouse_code",
            "location_code",
            "product_sku",
            "stock_status",
            "on_hand_qty",
            "available_qty",
            "allocated_qty",
            "hold_qty",
            "age_days",
            "last_activity",
        ]
    elif payload.report_type == OperationalReportType.RECEIVING_THROUGHPUT:
        rows = _receiving_throughput_rows(
            organization=payload.organization,
            warehouse=payload.warehouse,
            date_from=payload.date_from,
            date_to=payload.date_to,
        )
        headers = [
            "receipt_number",
            "warehouse_name",
            "warehouse_code",
            "received_at",
            "line_count",
            "total_qty",
            "received_by",
        ]
    elif payload.report_type == OperationalReportType.SHIPPING_THROUGHPUT:
        rows = _shipping_throughput_rows(
            organization=payload.organization,
            warehouse=payload.warehouse,
            date_from=payload.date_from,
            date_to=payload.date_to,
        )
        headers = [
            "shipment_number",
            "warehouse_name",
            "warehouse_code",
            "customer_name",
            "shipped_at",
            "line_count",
            "total_qty",
            "shipped_by",
        ]
    else:
        raise ValidationError({"report_type": f"Unsupported report type `{payload.report_type}`."})

    scope = payload.warehouse.code.lower() if payload.warehouse is not None else "organization"
    file_name = f"{payload.report_type.lower()}-{scope}-{timezone.now().date().isoformat()}.csv"
    export = OperationalReportExport.objects.create(
        organization=payload.organization,
        warehouse=payload.warehouse,
        report_type=payload.report_type,
        status=OperationalReportStatus.GENERATED,
        export_format="csv",
        date_from=payload.date_from,
        date_to=payload.date_to,
        parameters=payload.parameters or {},
        file_name=file_name,
        row_count=len(rows),
        generated_at=timezone.now(),
        generated_by=operator_name.strip() or "system",
        content=_rows_to_csv(rows, headers),
    )
    return export
