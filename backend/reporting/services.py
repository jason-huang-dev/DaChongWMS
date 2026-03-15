"""Warehouse KPI snapshots, exports, and storage accrual services."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from inventory.models import InventoryBalance
from inventory.services import ensure_tenant_match
from reporting.billing_services import BillingChargePayload, upsert_charge_event
from operations.counting.models import CountApproval, CountApprovalStatus
from operations.inbound.models import PurchaseOrder, PurchaseOrderStatus, PutawayTask, PutawayTaskStatus, Receipt
from operations.outbound.models import PickTask, PickTaskStatus, SalesOrder, SalesOrderStatus, Shipment
from operations.returns.models import ReturnOrder, ReturnOrderStatus
from warehouse.models import Warehouse

from .settlement_services import collectible_amount as invoice_collectible_amount
from .models import (
    BillingChargeStatus,
    BillingChargeType,
    CreditNoteStatus,
    FinanceApprovalStatus,
    FinanceExport,
    FinanceExportStatus,
    InvoiceDisputeStatus,
    InvoiceRemittanceSource,
    Invoice,
    InvoiceStatus,
    InvoiceSettlementStatus,
    OperationalReportExport,
    OperationalReportStatus,
    OperationalReportType,
    StorageAccrualRun,
    StorageAccrualStatus,
    WarehouseKpiSnapshot,
)

ZERO = Decimal("0.0000")


@dataclass(frozen=True)
class KpiSnapshotPayload:
    warehouse: Warehouse
    snapshot_date: date


@dataclass(frozen=True)
class OperationalReportPayload:
    warehouse: Warehouse | None
    report_type: str
    date_from: date | None
    date_to: date | None
    parameters: dict[str, object]


@dataclass(frozen=True)
class StorageAccrualPayload:
    warehouse: Warehouse
    customer: object
    accrual_date: date
    notes: str = ""


@dataclass(frozen=True)
class FinanceExportPayload:
    warehouse: Warehouse | None
    customer: object | None
    period_start: date
    period_end: date
    parameters: dict[str, object]


def _balance_totals(openid: str, warehouse: Warehouse) -> dict[str, Decimal]:
    available_expr = ExpressionWrapper(
        F("on_hand_qty") - F("allocated_qty") - F("hold_qty"),
        output_field=DecimalField(max_digits=18, decimal_places=4),
    )
    totals = InventoryBalance.objects.filter(openid=openid, warehouse=warehouse, is_delete=False).aggregate(
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
def generate_warehouse_kpi_snapshot(*, openid: str, operator_name: str, payload: KpiSnapshotPayload) -> WarehouseKpiSnapshot:
    ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    totals = _balance_totals(openid, payload.warehouse)
    snapshot, _ = WarehouseKpiSnapshot.objects.update_or_create(
        openid=openid,
        warehouse=payload.warehouse,
        snapshot_date=payload.snapshot_date,
        is_delete=False,
        defaults={
            "generated_by": operator_name,
            "on_hand_qty": totals["on_hand_qty"],
            "available_qty": totals["available_qty"],
            "allocated_qty": totals["allocated_qty"],
            "hold_qty": totals["hold_qty"],
            "open_purchase_orders": PurchaseOrder.objects.filter(
                openid=openid,
                warehouse=payload.warehouse,
                is_delete=False,
                status__in=[PurchaseOrderStatus.OPEN, PurchaseOrderStatus.PARTIAL],
            ).count(),
            "open_sales_orders": SalesOrder.objects.filter(
                openid=openid,
                warehouse=payload.warehouse,
                is_delete=False,
                status__in=[SalesOrderStatus.OPEN, SalesOrderStatus.ALLOCATED, SalesOrderStatus.PICKING, SalesOrderStatus.PICKED],
            ).count(),
            "open_putaway_tasks": PutawayTask.objects.filter(
                openid=openid,
                warehouse=payload.warehouse,
                is_delete=False,
                status__in=[PutawayTaskStatus.OPEN, PutawayTaskStatus.ASSIGNED],
            ).count(),
            "open_pick_tasks": PickTask.objects.filter(
                openid=openid,
                warehouse=payload.warehouse,
                is_delete=False,
                status__in=[PickTaskStatus.OPEN, PickTaskStatus.ASSIGNED],
            ).count(),
            "pending_count_approvals": CountApproval.objects.filter(
                openid=openid,
                cycle_count_line__cycle_count__warehouse=payload.warehouse,
                is_delete=False,
                status=CountApprovalStatus.PENDING,
            ).count(),
            "pending_return_orders": ReturnOrder.objects.filter(
                openid=openid,
                warehouse=payload.warehouse,
                is_delete=False,
                status__in=[
                    ReturnOrderStatus.OPEN,
                    ReturnOrderStatus.PARTIAL_RECEIVED,
                    ReturnOrderStatus.RECEIVED,
                    ReturnOrderStatus.PARTIAL_DISPOSED,
                ],
            ).count(),
            "creator": operator_name,
        },
    )
    return snapshot


def _inventory_aging_rows(*, openid: str, warehouse: Warehouse | None, as_of: date) -> list[dict[str, object]]:
    queryset = InventoryBalance.objects.select_related("warehouse", "location", "goods").filter(openid=openid, is_delete=False)
    if warehouse is not None:
        queryset = queryset.filter(warehouse=warehouse)
    rows: list[dict[str, object]] = []
    for balance in queryset.order_by("warehouse__warehouse_name", "location__location_code", "goods__goods_code"):
        age_days = max((as_of - balance.update_time.date()).days, 0)
        rows.append(
            {
                "warehouse_name": balance.warehouse.warehouse_name,
                "location_code": balance.location.location_code,
                "goods_code": balance.goods.goods_code,
                "stock_status": balance.stock_status,
                "on_hand_qty": str(balance.on_hand_qty),
                "available_qty": str(balance.on_hand_qty - balance.allocated_qty - balance.hold_qty),
                "allocated_qty": str(balance.allocated_qty),
                "hold_qty": str(balance.hold_qty),
                "age_days": age_days,
                "last_activity": balance.update_time.date().isoformat(),
            }
        )
    return rows


def _receiving_throughput_rows(*, openid: str, warehouse: Warehouse | None, date_from: date | None, date_to: date | None) -> list[dict[str, object]]:
    queryset = Receipt.objects.select_related("warehouse").prefetch_related("lines").filter(openid=openid, is_delete=False)
    if warehouse is not None:
        queryset = queryset.filter(warehouse=warehouse)
    if date_from is not None:
        queryset = queryset.filter(received_at__date__gte=date_from)
    if date_to is not None:
        queryset = queryset.filter(received_at__date__lte=date_to)
    rows: list[dict[str, object]] = []
    for receipt in queryset.order_by("received_at", "id"):
        total_qty = sum((line.received_qty for line in receipt.lines.filter(is_delete=False)), ZERO)
        rows.append(
            {
                "receipt_number": receipt.receipt_number,
                "warehouse_name": receipt.warehouse.warehouse_name,
                "received_at": receipt.received_at.isoformat(),
                "line_count": receipt.lines.filter(is_delete=False).count(),
                "total_qty": str(total_qty),
                "received_by": receipt.received_by,
            }
        )
    return rows


def _shipping_throughput_rows(*, openid: str, warehouse: Warehouse | None, date_from: date | None, date_to: date | None) -> list[dict[str, object]]:
    queryset = Shipment.objects.select_related("warehouse", "sales_order", "sales_order__customer").prefetch_related("lines").filter(openid=openid, is_delete=False)
    if warehouse is not None:
        queryset = queryset.filter(warehouse=warehouse)
    if date_from is not None:
        queryset = queryset.filter(shipped_at__date__gte=date_from)
    if date_to is not None:
        queryset = queryset.filter(shipped_at__date__lte=date_to)
    rows: list[dict[str, object]] = []
    for shipment in queryset.order_by("shipped_at", "id"):
        total_qty = sum((line.shipped_qty for line in shipment.lines.filter(is_delete=False)), ZERO)
        rows.append(
            {
                "shipment_number": shipment.shipment_number,
                "warehouse_name": shipment.warehouse.warehouse_name,
                "customer_name": shipment.sales_order.customer.customer_name,
                "shipped_at": shipment.shipped_at.isoformat(),
                "line_count": shipment.lines.filter(is_delete=False).count(),
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


def _storage_accrual_totals(*, openid: str, warehouse: Warehouse) -> tuple[int, Decimal]:
    queryset = InventoryBalance.objects.filter(openid=openid, warehouse=warehouse, is_delete=False)
    totals = queryset.aggregate(on_hand_total=Sum("on_hand_qty"))
    return queryset.count(), totals["on_hand_total"] or ZERO


@transaction.atomic
def generate_operational_report(*, openid: str, operator_name: str, payload: OperationalReportPayload) -> OperationalReportExport:
    if payload.warehouse is not None:
        ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    if payload.date_from and payload.date_to and payload.date_from > payload.date_to:
        raise ValidationError({"detail": "date_from cannot be after date_to"})

    if payload.report_type == OperationalReportType.INVENTORY_AGING:
        rows = _inventory_aging_rows(openid=openid, warehouse=payload.warehouse, as_of=payload.date_to or payload.date_from or date.today())
        headers = [
            "warehouse_name",
            "location_code",
            "goods_code",
            "stock_status",
            "on_hand_qty",
            "available_qty",
            "allocated_qty",
            "hold_qty",
            "age_days",
            "last_activity",
        ]
    elif payload.report_type == OperationalReportType.RECEIVING_THROUGHPUT:
        rows = _receiving_throughput_rows(openid=openid, warehouse=payload.warehouse, date_from=payload.date_from, date_to=payload.date_to)
        headers = ["receipt_number", "warehouse_name", "received_at", "line_count", "total_qty", "received_by"]
    elif payload.report_type == OperationalReportType.SHIPPING_THROUGHPUT:
        rows = _shipping_throughput_rows(openid=openid, warehouse=payload.warehouse, date_from=payload.date_from, date_to=payload.date_to)
        headers = ["shipment_number", "warehouse_name", "customer_name", "shipped_at", "line_count", "total_qty", "shipped_by"]
    else:
        raise ValidationError({"detail": f"Unsupported report type `{payload.report_type}`"})

    scope = payload.warehouse.warehouse_name if payload.warehouse is not None else "tenant"
    file_name = f"{payload.report_type.lower()}-{scope.replace(' ', '-').lower()}-{date.today().isoformat()}.csv"
    export = OperationalReportExport.objects.create(
        warehouse=payload.warehouse,
        report_type=payload.report_type,
        status=OperationalReportStatus.GENERATED,
        date_from=payload.date_from,
        date_to=payload.date_to,
        parameters=payload.parameters,
        file_name=file_name,
        row_count=len(rows),
        generated_by=operator_name,
        content=_rows_to_csv(rows, headers),
        creator=operator_name,
        openid=openid,
    )
    return export


@transaction.atomic
def generate_storage_accrual_run(*, openid: str, operator_name: str, payload: StorageAccrualPayload) -> StorageAccrualRun:
    ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    ensure_tenant_match(payload.customer, openid, "Customer")
    balance_count, total_on_hand_qty = _storage_accrual_totals(openid=openid, warehouse=payload.warehouse)
    accrual_run, _ = StorageAccrualRun.objects.update_or_create(
        openid=openid,
        warehouse=payload.warehouse,
        customer=payload.customer,
        accrual_date=payload.accrual_date,
        is_delete=False,
        defaults={
            "status": StorageAccrualStatus.GENERATED,
            "basis": "CURRENT_ON_HAND_SNAPSHOT",
            "balance_count": balance_count,
            "total_on_hand_qty": total_on_hand_qty,
            "generated_at": timezone.now(),
            "generated_by": operator_name,
            "notes": payload.notes,
            "creator": operator_name,
        },
    )
    if accrual_run.charge_event_id and accrual_run.charge_event.status == BillingChargeStatus.INVOICED:
        raise ValidationError({"detail": "Invoiced storage accrual runs cannot be regenerated"})
    charge_event = upsert_charge_event(
        openid=openid,
        operator_name=operator_name,
        payload=BillingChargePayload(
            warehouse=payload.warehouse,
            customer=payload.customer,
            charge_type=BillingChargeType.STORAGE_DAILY,
            event_date=payload.accrual_date,
            quantity=total_on_hand_qty,
            uom="EA",
            unit_rate=ZERO,
            currency="USD",
            status=BillingChargeStatus.OPEN,
            source_module="reporting.storage",
            source_record_type="StorageAccrualRun",
            source_record_id=accrual_run.id,
            reference_code=f"STOR-{payload.accrual_date.isoformat()}",
            notes=payload.notes or "Storage accrual generated from the current warehouse on-hand snapshot",
        ),
    )
    accrual_run.charge_event = charge_event
    accrual_run.save(update_fields=["charge_event", "update_time"])
    return accrual_run


@transaction.atomic
def generate_finance_export(*, openid: str, operator_name: str, payload: FinanceExportPayload) -> FinanceExport:
    if payload.period_start > payload.period_end:
        raise ValidationError({"detail": "period_start cannot be after period_end"})
    if payload.warehouse is not None:
        ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    if payload.customer is not None:
        ensure_tenant_match(payload.customer, openid, "Customer")

    queryset = (
        Invoice.objects.select_related("warehouse", "customer", "finance_approval", "settlement")
        .prefetch_related("disputes", "credit_notes", "settlement__remittances")
        .filter(
            openid=openid,
            is_delete=False,
            status=InvoiceStatus.FINALIZED,
            period_start__gte=payload.period_start,
            period_end__lte=payload.period_end,
            finance_approval__status=FinanceApprovalStatus.APPROVED,
        )
        .order_by("period_start", "invoice_number")
    )
    if payload.warehouse is not None:
        queryset = queryset.filter(warehouse=payload.warehouse)
    if payload.customer is not None:
        queryset = queryset.filter(customer=payload.customer)

    rows: list[dict[str, object]] = []
    for invoice in queryset:
        approval = invoice.finance_approval
        settlement = getattr(invoice, "settlement", None)
        credit_note_total = sum(
            (
                credit_note.amount
                for credit_note in invoice.credit_notes.filter(
                    is_delete=False,
                    status__in=[CreditNoteStatus.ISSUED, CreditNoteStatus.APPLIED],
                )
            ),
            ZERO,
        )
        resolved_dispute_amount = sum(
            (
                dispute.approved_credit_amount
                for dispute in invoice.disputes.filter(is_delete=False, status=InvoiceDisputeStatus.RESOLVED)
            ),
            ZERO,
        )
        open_dispute_count = invoice.disputes.filter(
            is_delete=False,
            status__in=[InvoiceDisputeStatus.OPEN, InvoiceDisputeStatus.UNDER_REVIEW],
        ).count()
        collectible_amount = invoice_collectible_amount(invoice=invoice)
        remitted_amount = settlement.remitted_amount if settlement is not None else ZERO
        external_remitted_amount = sum(
            (
                remittance.amount
                for remittance in (
                    settlement.remittances.filter(is_delete=False, source=InvoiceRemittanceSource.EXTERNAL)
                    if settlement is not None
                    else []
                )
            ),
            ZERO,
        )
        outstanding_amount = max(collectible_amount - remitted_amount, ZERO)
        rows.append(
            {
                "invoice_number": invoice.invoice_number,
                "warehouse_name": invoice.warehouse.warehouse_name,
                "customer_name": invoice.customer.customer_name,
                "period_start": invoice.period_start.isoformat(),
                "period_end": invoice.period_end.isoformat(),
                "currency": invoice.currency,
                "subtotal_amount": str(invoice.subtotal_amount),
                "tax_amount": str(invoice.tax_amount),
                "total_amount": str(invoice.total_amount),
                "finalized_at": invoice.finalized_at.isoformat() if invoice.finalized_at else "",
                "approved_at": approval.reviewed_at.isoformat() if approval.reviewed_at else "",
                "approved_by": approval.reviewed_by,
                "settlement_status": settlement.status if settlement is not None else InvoiceSettlementStatus.PENDING_APPROVAL,
                "approved_settlement_amount": str(settlement.approved_amount if settlement is not None else ZERO),
                "remitted_amount": str(remitted_amount),
                "external_remitted_amount": str(external_remitted_amount),
                "credit_note_total": str(credit_note_total),
                "resolved_dispute_amount": str(resolved_dispute_amount),
                "open_dispute_count": open_dispute_count,
                "outstanding_amount": str(outstanding_amount),
            }
        )
    headers = [
        "invoice_number",
        "warehouse_name",
        "customer_name",
        "period_start",
        "period_end",
        "currency",
        "subtotal_amount",
        "tax_amount",
        "total_amount",
        "finalized_at",
        "approved_at",
        "approved_by",
        "settlement_status",
        "approved_settlement_amount",
        "remitted_amount",
        "external_remitted_amount",
        "credit_note_total",
        "resolved_dispute_amount",
        "open_dispute_count",
        "outstanding_amount",
    ]
    scope = payload.customer.customer_name if payload.customer is not None else payload.warehouse.warehouse_name if payload.warehouse is not None else "tenant"
    file_name = f"finance-export-{scope.replace(' ', '-').lower()}-{payload.period_start.isoformat()}-{payload.period_end.isoformat()}.csv"
    return FinanceExport.objects.create(
        warehouse=payload.warehouse,
        customer=payload.customer,
        status=FinanceExportStatus.GENERATED,
        export_format="csv",
        period_start=payload.period_start,
        period_end=payload.period_end,
        parameters=payload.parameters,
        file_name=file_name,
        row_count=len(rows),
        generated_by=operator_name,
        content=_rows_to_csv(rows, headers),
        creator=operator_name,
        openid=openid,
    )
