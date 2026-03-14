from __future__ import annotations

from django.contrib import admin

from .models import (
    InventoryAdjustmentApprovalRule,
    InventoryAdjustmentReason,
    InventoryBalance,
    InventoryHold,
    InventoryMovement,
)


@admin.register(InventoryBalance)
class InventoryBalanceAdmin(admin.ModelAdmin):
    list_display = ("goods", "location", "stock_status", "on_hand_qty", "allocated_qty", "hold_qty", "openid")
    list_filter = ("stock_status", "currency", "is_delete")
    search_fields = ("goods__goods_code", "location__location_code", "lot_number", "serial_number", "openid")


@admin.register(InventoryMovement)
class InventoryMovementAdmin(admin.ModelAdmin):
    list_display = ("movement_type", "goods", "quantity", "from_location", "to_location", "performed_by", "occurred_at")
    list_filter = ("movement_type", "stock_status", "is_delete")
    search_fields = ("goods__goods_code", "reference_code", "reason", "performed_by", "openid")


@admin.register(InventoryHold)
class InventoryHoldAdmin(admin.ModelAdmin):
    list_display = ("inventory_balance", "quantity", "reason", "held_by", "released_by", "is_active")
    list_filter = ("is_active", "is_delete")
    search_fields = ("inventory_balance__goods__goods_code", "reason", "reference_code", "held_by", "openid")


@admin.register(InventoryAdjustmentReason)
class InventoryAdjustmentReasonAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "direction", "requires_approval", "is_active", "openid")
    list_filter = ("direction", "requires_approval", "is_active", "is_delete")
    search_fields = ("code", "name", "description", "openid")


@admin.register(InventoryAdjustmentApprovalRule)
class InventoryAdjustmentApprovalRuleAdmin(admin.ModelAdmin):
    list_display = ("adjustment_reason", "warehouse", "minimum_variance_qty", "approver_role", "is_active")
    list_filter = ("approver_role", "is_active", "is_delete")
    search_fields = ("adjustment_reason__code", "approver_role", "openid")
