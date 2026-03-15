"""Serializers for KPI snapshots, exports, and billing events."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import (
    BillingChargeEvent,
    BillingRateContract,
    CreditNote,
    ExternalRemittanceBatch,
    ExternalRemittanceItem,
    FinanceExport,
    Invoice,
    InvoiceDispute,
    InvoiceFinanceApproval,
    InvoiceLine,
    InvoiceRemittance,
    InvoiceSettlement,
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


class InvoiceRemittanceSerializer(serializers.ModelSerializer[InvoiceRemittance]):
    class Meta:
        model = InvoiceRemittance
        fields = [
            "id",
            "settlement",
            "status",
            "source",
            "remittance_reference",
            "external_reference",
            "remitted_at",
            "remitted_by",
            "amount",
            "currency",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "source",
            "external_reference",
            "remitted_at",
            "remitted_by",
            "currency",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class InvoiceSettlementSerializer(serializers.ModelSerializer[InvoiceSettlement]):
    remittances = InvoiceRemittanceSerializer(many=True, read_only=True)

    class Meta:
        model = InvoiceSettlement
        fields = [
            "id",
            "invoice",
            "status",
            "requested_amount",
            "approved_amount",
            "remitted_amount",
            "currency",
            "due_date",
            "settlement_reference",
            "submitted_at",
            "submitted_by",
            "reviewed_at",
            "reviewed_by",
            "completed_at",
            "notes",
            "remittances",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "approved_amount",
            "remitted_amount",
            "currency",
            "submitted_at",
            "submitted_by",
            "reviewed_at",
            "reviewed_by",
            "completed_at",
            "remittances",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class InvoiceDisputeSerializer(serializers.ModelSerializer[InvoiceDispute]):
    class Meta:
        model = InvoiceDispute
        fields = [
            "id",
            "invoice",
            "invoice_line",
            "status",
            "reason_code",
            "reference_code",
            "disputed_amount",
            "approved_credit_amount",
            "opened_at",
            "opened_by",
            "reviewed_at",
            "reviewed_by",
            "resolved_at",
            "resolved_by",
            "notes",
            "resolution_notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "approved_credit_amount",
            "opened_at",
            "opened_by",
            "reviewed_at",
            "reviewed_by",
            "resolved_at",
            "resolved_by",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class CreditNoteSerializer(serializers.ModelSerializer[CreditNote]):
    class Meta:
        model = CreditNote
        fields = [
            "id",
            "invoice",
            "dispute",
            "credit_note_number",
            "status",
            "reason_code",
            "amount",
            "currency",
            "reference_code",
            "issued_at",
            "issued_by",
            "applied_at",
            "applied_by",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "currency",
            "issued_at",
            "issued_by",
            "applied_at",
            "applied_by",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        extra_kwargs = {
            "amount": {"required": False},
            "dispute": {"required": False, "allow_null": True},
            "reason_code": {"required": False},
            "reference_code": {"required": False},
            "notes": {"required": False},
        }


class ExternalRemittanceItemSerializer(serializers.ModelSerializer[ExternalRemittanceItem]):
    class Meta:
        model = ExternalRemittanceItem
        fields = [
            "id",
            "invoice",
            "settlement",
            "remittance",
            "external_reference",
            "matched_invoice_number",
            "matched_settlement_reference",
            "amount",
            "currency",
            "status",
            "processed_at",
            "error_message",
            "payload",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class ExternalRemittanceBatchSerializer(serializers.ModelSerializer[ExternalRemittanceBatch]):
    items = ExternalRemittanceItemSerializer(many=True, read_only=True)

    class Meta:
        model = ExternalRemittanceBatch
        fields = [
            "id",
            "source_system",
            "external_batch_id",
            "status",
            "submitted_at",
            "processed_at",
            "item_count",
            "applied_count",
            "conflict_count",
            "failed_count",
            "last_error",
            "payload",
            "notes",
            "items",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "submitted_at",
            "processed_at",
            "item_count",
            "applied_count",
            "conflict_count",
            "failed_count",
            "last_error",
            "items",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class InvoiceSerializer(serializers.ModelSerializer[Invoice]):
    lines = InvoiceLineSerializer(many=True, read_only=True)
    finance_approval = InvoiceFinanceApprovalSerializer(read_only=True)
    settlement = InvoiceSettlementSerializer(read_only=True)
    disputes = InvoiceDisputeSerializer(many=True, read_only=True)
    credit_notes = CreditNoteSerializer(many=True, read_only=True)

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
            "settlement",
            "disputes",
            "credit_notes",
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
            "settlement",
            "disputes",
            "credit_notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class InvoiceFinalizeSerializer(serializers.Serializer[dict[str, object]]):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class InvoiceFinanceReviewActionSerializer(serializers.Serializer[dict[str, object]]):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class InvoiceSettlementReviewActionSerializer(serializers.Serializer[dict[str, object]]):
    approved_amount = serializers.DecimalField(
        required=False,
        max_digits=18,
        decimal_places=4,
        min_value=Decimal("0.0000"),
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class InvoiceRemittanceCreateSerializer(serializers.Serializer[dict[str, object]]):
    settlement = serializers.PrimaryKeyRelatedField(queryset=InvoiceSettlement.objects.filter(is_delete=False))
    amount = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    remittance_reference = serializers.CharField(max_length=64)
    remitted_at = serializers.DateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class InvoiceDisputeReviewActionSerializer(serializers.Serializer[dict[str, object]]):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class InvoiceDisputeResolveActionSerializer(serializers.Serializer[dict[str, object]]):
    approved_credit_amount = serializers.DecimalField(
        required=False,
        max_digits=18,
        decimal_places=4,
        min_value=Decimal("0.0000"),
        default=Decimal("0.0000"),
    )
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CreditNoteApplyActionSerializer(serializers.Serializer[dict[str, object]]):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class ExternalRemittanceItemInputSerializer(serializers.Serializer[dict[str, object]]):
    external_reference = serializers.CharField(max_length=128)
    amount = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    currency = serializers.CharField(required=False, allow_blank=True, default="USD")
    invoice_number = serializers.CharField(required=False, allow_blank=True, default="")
    settlement_reference = serializers.CharField(required=False, allow_blank=True, default="")
    remitted_at = serializers.DateTimeField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    payload = serializers.JSONField(required=False, default=dict)


class ExternalRemittanceBatchCreateSerializer(serializers.Serializer[dict[str, object]]):
    source_system = serializers.CharField(max_length=64)
    external_batch_id = serializers.CharField(max_length=128)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    payload = serializers.JSONField(required=False, default=dict)
    items = ExternalRemittanceItemInputSerializer(many=True)


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
