from __future__ import annotations

from rest_framework import serializers

from .models import (
    BalanceTransaction,
    BusinessExpense,
    ChargeItem,
    ChargeTemplate,
    FundFlow,
    ManualCharge,
    ProfitCalculation,
    ReceivableBill,
    RentDetail,
    Voucher,
)


class BalanceTransactionSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)
    voucher_code = serializers.CharField(source="voucher.code", read_only=True)

    class Meta:
        model = BalanceTransaction
        fields = (
            "id",
            "organization_id",
            "customer_account",
            "customer_account_name",
            "voucher",
            "voucher_code",
            "transaction_type",
            "status",
            "reference_code",
            "amount",
            "currency",
            "requested_by_name",
            "reviewed_by_name",
            "requested_at",
            "reviewed_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "customer_account_name",
            "voucher_code",
            "created_at",
            "updated_at",
        )


class VoucherSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)

    class Meta:
        model = Voucher
        fields = (
            "id",
            "organization_id",
            "customer_account",
            "customer_account_name",
            "code",
            "voucher_type",
            "status",
            "face_value",
            "remaining_value",
            "currency",
            "valid_from",
            "expires_on",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "customer_account_name", "created_at", "updated_at")


class ChargeItemSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ChargeItem
        fields = (
            "id",
            "organization_id",
            "code",
            "name",
            "category",
            "billing_basis",
            "default_unit_price",
            "currency",
            "unit_label",
            "is_taxable",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "created_at", "updated_at")


class ChargeTemplateSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    charge_item_name = serializers.CharField(source="charge_item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)

    class Meta:
        model = ChargeTemplate
        fields = (
            "id",
            "organization_id",
            "charge_item",
            "charge_item_name",
            "warehouse",
            "warehouse_name",
            "customer_account",
            "customer_account_name",
            "code",
            "name",
            "default_quantity",
            "default_unit_price",
            "currency",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "charge_item_name",
            "warehouse_name",
            "customer_account_name",
            "created_at",
            "updated_at",
        )


class ManualChargeSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    charge_item_name = serializers.CharField(source="charge_item.name", read_only=True)
    charge_template_name = serializers.CharField(source="charge_template.name", read_only=True)

    class Meta:
        model = ManualCharge
        fields = (
            "id",
            "organization_id",
            "customer_account",
            "customer_account_name",
            "warehouse",
            "warehouse_name",
            "charge_item",
            "charge_item_name",
            "charge_template",
            "charge_template_name",
            "status",
            "source_reference",
            "description",
            "quantity",
            "unit_price",
            "amount",
            "currency",
            "charged_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "customer_account_name",
            "warehouse_name",
            "charge_item_name",
            "charge_template_name",
            "amount",
            "created_at",
            "updated_at",
        )


class FundFlowSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)

    class Meta:
        model = FundFlow
        fields = (
            "id",
            "organization_id",
            "warehouse",
            "warehouse_name",
            "customer_account",
            "customer_account_name",
            "flow_type",
            "source_type",
            "reference_code",
            "status",
            "amount",
            "currency",
            "occurred_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "warehouse_name",
            "customer_account_name",
            "created_at",
            "updated_at",
        )


class RentDetailSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)

    class Meta:
        model = RentDetail
        fields = (
            "id",
            "organization_id",
            "warehouse",
            "warehouse_name",
            "customer_account",
            "customer_account_name",
            "period_start",
            "period_end",
            "pallet_positions",
            "bin_positions",
            "area_sqm",
            "amount",
            "currency",
            "status",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "warehouse_name",
            "customer_account_name",
            "created_at",
            "updated_at",
        )


class BusinessExpenseSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = BusinessExpense
        fields = (
            "id",
            "organization_id",
            "warehouse",
            "warehouse_name",
            "vendor_name",
            "expense_category",
            "status",
            "expense_date",
            "amount",
            "currency",
            "reference_code",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "warehouse_name", "created_at", "updated_at")


class ReceivableBillSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = ReceivableBill
        fields = (
            "id",
            "organization_id",
            "customer_account",
            "customer_account_name",
            "warehouse",
            "warehouse_name",
            "bill_number",
            "period_start",
            "period_end",
            "status",
            "subtotal_amount",
            "adjustment_amount",
            "total_amount",
            "currency",
            "due_at",
            "issued_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "customer_account_name",
            "warehouse_name",
            "total_amount",
            "created_at",
            "updated_at",
        )


class ProfitCalculationSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)

    class Meta:
        model = ProfitCalculation
        fields = (
            "id",
            "organization_id",
            "warehouse",
            "warehouse_name",
            "customer_account",
            "customer_account_name",
            "period_start",
            "period_end",
            "revenue_amount",
            "expense_amount",
            "recharge_amount",
            "deduction_amount",
            "receivable_amount",
            "profit_amount",
            "margin_percent",
            "status",
            "generated_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "warehouse_name",
            "customer_account_name",
            "profit_amount",
            "margin_percent",
            "created_at",
            "updated_at",
        )

