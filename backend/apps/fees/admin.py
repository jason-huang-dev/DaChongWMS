from django.contrib import admin

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


@admin.register(BalanceTransaction)
class BalanceTransactionAdmin(admin.ModelAdmin):
    list_display = ("reference_code", "transaction_type", "status", "amount", "currency", "organization")
    list_filter = ("transaction_type", "status", "currency")
    search_fields = ("reference_code", "requested_by_name", "reviewed_by_name")


@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
    list_display = ("code", "voucher_type", "status", "face_value", "remaining_value", "organization")
    list_filter = ("voucher_type", "status", "currency")
    search_fields = ("code",)


@admin.register(ChargeItem)
class ChargeItemAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "category", "billing_basis", "default_unit_price", "organization")
    list_filter = ("category", "billing_basis", "is_active")
    search_fields = ("code", "name")


@admin.register(ChargeTemplate)
class ChargeTemplateAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "charge_item", "warehouse", "customer_account", "organization")
    list_filter = ("is_active",)
    search_fields = ("code", "name")


@admin.register(ManualCharge)
class ManualChargeAdmin(admin.ModelAdmin):
    list_display = ("source_reference", "status", "amount", "currency", "warehouse", "organization")
    list_filter = ("status", "currency")
    search_fields = ("source_reference", "description")


@admin.register(FundFlow)
class FundFlowAdmin(admin.ModelAdmin):
    list_display = ("reference_code", "flow_type", "status", "amount", "currency", "organization")
    list_filter = ("flow_type", "status", "currency")
    search_fields = ("reference_code", "source_type")


@admin.register(RentDetail)
class RentDetailAdmin(admin.ModelAdmin):
    list_display = ("warehouse", "customer_account", "period_start", "period_end", "amount", "organization")
    list_filter = ("status", "currency")


@admin.register(BusinessExpense)
class BusinessExpenseAdmin(admin.ModelAdmin):
    list_display = ("reference_code", "expense_category", "status", "amount", "currency", "organization")
    list_filter = ("expense_category", "status", "currency")
    search_fields = ("reference_code", "vendor_name")


@admin.register(ReceivableBill)
class ReceivableBillAdmin(admin.ModelAdmin):
    list_display = ("bill_number", "status", "total_amount", "currency", "warehouse", "organization")
    list_filter = ("status", "currency")
    search_fields = ("bill_number",)


@admin.register(ProfitCalculation)
class ProfitCalculationAdmin(admin.ModelAdmin):
    list_display = ("period_start", "period_end", "profit_amount", "margin_percent", "status", "organization")
    list_filter = ("status",)

