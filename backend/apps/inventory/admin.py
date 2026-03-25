from django.contrib import admin

from apps.inventory.models import (
    InventoryAdjustmentApprovalRule,
    InventoryAdjustmentReason,
    InventoryBalance,
    InventoryHold,
    InventoryMovement,
)


@admin.register(InventoryBalance)
class InventoryBalanceAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "location", "product", "stock_status", "on_hand_qty", "hold_qty")
    search_fields = ("product__sku", "location__code", "warehouse__name", "organization__name")
    list_filter = ("stock_status", "warehouse")


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "product", "movement_type", "quantity", "occurred_at")
    search_fields = ("product__sku", "reference_code", "performed_by", "organization__name")
    list_filter = ("movement_type", "warehouse")


@admin.register(InventoryHold)
class InventoryHoldAdmin(admin.ModelAdmin):
    list_display = ("organization", "inventory_balance", "quantity", "reason", "held_by", "is_active")
    search_fields = ("reason", "held_by", "inventory_balance__product__sku", "organization__name")
    list_filter = ("is_active",)


@admin.register(InventoryAdjustmentReason)
class InventoryAdjustmentReasonAdmin(admin.ModelAdmin):
    list_display = ("organization", "code", "name", "direction", "requires_approval", "is_active")
    search_fields = ("code", "name", "organization__name")
    list_filter = ("direction", "requires_approval", "is_active")


@admin.register(InventoryAdjustmentApprovalRule)
class InventoryAdjustmentApprovalRuleAdmin(admin.ModelAdmin):
    list_display = ("organization", "adjustment_reason", "warehouse", "minimum_variance_qty", "approver_role", "is_active")
    search_fields = ("adjustment_reason__code", "approver_role", "organization__name")
    list_filter = ("is_active", "warehouse")

