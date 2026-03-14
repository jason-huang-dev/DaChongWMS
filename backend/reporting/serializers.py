"""Serializers for KPI snapshots, exports, and billing events."""

from __future__ import annotations

from rest_framework import serializers

from .models import (
    BillingChargeEvent,
    BillingRateContract,
    FinanceExport,
    Invoice,
    InvoiceFinanceApproval,
    InvoiceLine,
    OperationalReportExport,
    StorageAccrualRun,
    WarehouseKpiSnapshot,
)


class WarehouseKpiSnapshotSerializer(serializers.ModelSerializer[WarehouseKpiSnapshot]):
    class Meta:
        model = WarehouseKpiSnapshot
        fields = [
            "id",
            "warehouse",
            "snapshot_date",
            "generated_at",
            "generated_by",
            "on_hand_qty",
            "available_qty",
            "allocated_qty",
            "hold_qty",
            "open_purchase_orders",
            "open_sales_orders",
            "open_putaway_tasks",
            "open_pick_tasks",
            "pending_count_approvals",
            "pending_return_orders",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "generated_at",
            "generated_by",
            "on_hand_qty",
            "available_qty",
            "allocated_qty",
            "hold_qty",
            "open_purchase_orders",
            "open_sales_orders",
            "open_putaway_tasks",
            "open_pick_tasks",
            "pending_count_approvals",
            "pending_return_orders",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class OperationalReportExportSerializer(serializers.ModelSerializer[OperationalReportExport]):
    class Meta:
        model = OperationalReportExport
        fields = [
            "id",
            "warehouse",
            "report_type",
            "status",
            "export_format",
            "date_from",
            "date_to",
            "parameters",
            "file_name",
            "row_count",
            "generated_at",
            "generated_by",
            "content",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "export_format",
            "file_name",
            "row_count",
            "generated_at",
            "generated_by",
            "content",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class BillingChargeEventSerializer(serializers.ModelSerializer[BillingChargeEvent]):
    class Meta:
        model = BillingChargeEvent
        fields = [
            "id",
            "warehouse",
            "customer",
            "rate_contract",
            "charge_type",
            "event_date",
            "quantity",
            "uom",
            "unit_rate",
            "amount",
            "currency",
            "status",
            "source_module",
            "source_record_type",
            "source_record_id",
            "reference_code",
            "notes",
            "rated_at",
            "rated_by",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["amount", "rate_contract", "rated_at", "rated_by", "creator", "openid", "create_time", "update_time"]


class BillingRateContractSerializer(serializers.ModelSerializer[BillingRateContract]):
    class Meta:
        model = BillingRateContract
        fields = [
            "id",
            "warehouse",
            "customer",
            "contract_name",
            "charge_type",
            "unit_rate",
            "minimum_charge",
            "currency",
            "uom",
            "priority",
            "effective_from",
            "effective_to",
            "is_active",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["creator", "openid", "create_time", "update_time"]


class StorageAccrualRunSerializer(serializers.ModelSerializer[StorageAccrualRun]):
    class Meta:
        model = StorageAccrualRun
        fields = [
            "id",
            "warehouse",
            "customer",
            "accrual_date",
            "status",
            "basis",
            "balance_count",
            "total_on_hand_qty",
            "generated_at",
            "generated_by",
            "charge_event",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "basis",
            "balance_count",
            "total_on_hand_qty",
            "generated_at",
            "generated_by",
            "charge_event",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class InvoiceFinanceApprovalSerializer(serializers.ModelSerializer[InvoiceFinanceApproval]):
    class Meta:
        model = InvoiceFinanceApproval
        fields = [
            "id",
            "status",
            "submitted_at",
            "submitted_by",
            "reviewed_at",
            "reviewed_by",
            "notes",
        ]
        read_only_fields = fields


class InvoiceLineSerializer(serializers.ModelSerializer[InvoiceLine]):
    class Meta:
        model = InvoiceLine
        fields = [
            "id",
            "charge_event",
            "charge_type",
            "event_date",
            "quantity",
            "uom",
            "unit_rate",
            "amount",
            "description",
            "reference_code",
        ]
        read_only_fields = fields


class InvoiceSerializer(serializers.ModelSerializer[Invoice]):
    lines = InvoiceLineSerializer(many=True, read_only=True)
    finance_approval = InvoiceFinanceApprovalSerializer(read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "warehouse",
            "customer",
            "invoice_number",
            "period_start",
            "period_end",
            "status",
            "currency",
            "subtotal_amount",
            "tax_amount",
            "total_amount",
            "generated_at",
            "generated_by",
            "finalized_at",
            "finalized_by",
            "notes",
            "lines",
            "finance_approval",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "currency",
            "subtotal_amount",
            "tax_amount",
            "total_amount",
            "generated_at",
            "generated_by",
            "finalized_at",
            "finalized_by",
            "lines",
            "finance_approval",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class InvoiceFinalizeSerializer(serializers.Serializer[dict[str, object]]):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class InvoiceFinanceReviewActionSerializer(serializers.Serializer[dict[str, object]]):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class FinanceExportSerializer(serializers.ModelSerializer[FinanceExport]):
    class Meta:
        model = FinanceExport
        fields = [
            "id",
            "warehouse",
            "customer",
            "status",
            "export_format",
            "period_start",
            "period_end",
            "parameters",
            "file_name",
            "row_count",
            "generated_at",
            "generated_by",
            "content",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "export_format",
            "file_name",
            "row_count",
            "generated_at",
            "generated_by",
            "content",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
