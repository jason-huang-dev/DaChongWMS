from django.urls import path

from .views import (
    InventoryAdjustmentApprovalRuleDetailAPIView,
    InventoryAdjustmentApprovalRuleListCreateAPIView,
    InventoryAdjustmentReasonDetailAPIView,
    InventoryAdjustmentReasonListCreateAPIView,
    InventoryBalanceDetailAPIView,
    InventoryBalanceListAPIView,
    InventoryHoldDetailAPIView,
    InventoryHoldListCreateAPIView,
    InventoryMovementDetailAPIView,
    InventoryMovementListCreateAPIView,
)

urlpatterns = [
    path(
        "organizations/<int:organization_id>/inventory/balances/",
        InventoryBalanceListAPIView.as_view(),
        name="organization-inventory-balance-list",
    ),
    path(
        "organizations/<int:organization_id>/inventory/balances/<int:inventory_balance_id>/",
        InventoryBalanceDetailAPIView.as_view(),
        name="organization-inventory-balance-detail",
    ),
    path(
        "organizations/<int:organization_id>/inventory/movements/",
        InventoryMovementListCreateAPIView.as_view(),
        name="organization-inventory-movement-list",
    ),
    path(
        "organizations/<int:organization_id>/inventory/movements/<int:inventory_movement_id>/",
        InventoryMovementDetailAPIView.as_view(),
        name="organization-inventory-movement-detail",
    ),
    path(
        "organizations/<int:organization_id>/inventory/holds/",
        InventoryHoldListCreateAPIView.as_view(),
        name="organization-inventory-hold-list",
    ),
    path(
        "organizations/<int:organization_id>/inventory/holds/<int:inventory_hold_id>/",
        InventoryHoldDetailAPIView.as_view(),
        name="organization-inventory-hold-detail",
    ),
    path(
        "organizations/<int:organization_id>/inventory/adjustment-reasons/",
        InventoryAdjustmentReasonListCreateAPIView.as_view(),
        name="organization-inventory-adjustment-reason-list",
    ),
    path(
        "organizations/<int:organization_id>/inventory/adjustment-reasons/<int:inventory_adjustment_reason_id>/",
        InventoryAdjustmentReasonDetailAPIView.as_view(),
        name="organization-inventory-adjustment-reason-detail",
    ),
    path(
        "organizations/<int:organization_id>/inventory/adjustment-approval-rules/",
        InventoryAdjustmentApprovalRuleListCreateAPIView.as_view(),
        name="organization-inventory-adjustment-approval-rule-list",
    ),
    path(
        "organizations/<int:organization_id>/inventory/adjustment-approval-rules/<int:inventory_adjustment_approval_rule_id>/",
        InventoryAdjustmentApprovalRuleDetailAPIView.as_view(),
        name="organization-inventory-adjustment-approval-rule-detail",
    ),
]

