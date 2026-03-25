from __future__ import annotations

from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.inventory.models import (
    AdjustmentDirection,
    InventoryAdjustmentApprovalRule,
    InventoryAdjustmentReason,
    InventoryBalance,
    InventoryHold,
    InventoryMovement,
    InventoryStatus,
)
from apps.inventory.permissions import (
    CanManageInventoryConfiguration,
    CanManageInventoryRecords,
    CanViewInventory,
)
from apps.inventory.serializers import (
    InventoryAdjustmentApprovalRuleSerializer,
    InventoryAdjustmentReasonSerializer,
    InventoryBalanceSerializer,
    InventoryHoldSerializer,
    InventoryMovementSerializer,
)
from apps.inventory.services.inventory_service import (
    CreateInventoryAdjustmentApprovalRuleInput,
    CreateInventoryAdjustmentReasonInput,
    CreateInventoryHoldInput,
    CreateInventoryMovementInput,
    create_inventory_adjustment_approval_rule,
    create_inventory_adjustment_reason,
    create_inventory_hold,
    list_inventory_adjustment_approval_rules,
    list_inventory_adjustment_reasons,
    list_organization_inventory_balances,
    list_organization_inventory_holds,
    list_organization_inventory_movements,
    record_inventory_movement,
    release_inventory_hold,
    update_inventory_adjustment_approval_rule,
    update_inventory_adjustment_reason,
    update_inventory_hold,
)
from apps.locations.models import Location
from apps.organizations.models import Organization
from apps.products.models import Product
from apps.warehouse.models import Warehouse


def _actor_name_from_request(request: Request) -> str:
    email = getattr(request.user, "email", "")
    if isinstance(email, str) and email.strip():
        return email.strip()
    return "system"


class OrganizationInventoryBaseAPIView(APIView):
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)

    def get_warehouse(self, warehouse_id: int) -> Warehouse:
        return get_object_or_404(Warehouse, pk=warehouse_id, organization=self.organization)

    def get_product(self, product_id: int) -> Product:
        return get_object_or_404(Product, pk=product_id, organization=self.organization)

    def get_location(self, location_id: int) -> Location:
        return get_object_or_404(Location, pk=location_id, organization=self.organization)


class InventoryBalanceListAPIView(OrganizationInventoryBaseAPIView):
    permission_classes = [CanViewInventory]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        location_id = request.query_params.get("location_id")
        product_id = request.query_params.get("product_id")
        stock_status = request.query_params.get("stock_status")
        balances = list_organization_inventory_balances(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            location_id=int(location_id) if location_id else None,
            product_id=int(product_id) if product_id else None,
            stock_status=stock_status or None,
        )
        return Response(InventoryBalanceSerializer(balances, many=True).data)


class InventoryBalanceDetailAPIView(OrganizationInventoryBaseAPIView):
    permission_classes = [CanViewInventory]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        balance = get_object_or_404(
            InventoryBalance,
            pk=kwargs["inventory_balance_id"],
            organization=self.organization,
        )
        return Response(InventoryBalanceSerializer(balance).data)


class InventoryMovementListCreateAPIView(OrganizationInventoryBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInventory()]
        return [CanManageInventoryRecords()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        product_id = request.query_params.get("product_id")
        movement_type = request.query_params.get("movement_type")
        movements = list_organization_inventory_movements(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            product_id=int(product_id) if product_id else None,
            movement_type=movement_type or None,
        )
        return Response(InventoryMovementSerializer(movements, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = InventoryMovementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        warehouse = self.get_warehouse(serializer.validated_data["warehouse_id"])
        product = self.get_product(serializer.validated_data["product_id"])
        from_location = None
        from_location_id = serializer.validated_data.get("from_location_id")
        if from_location_id is not None:
            from_location = self.get_location(from_location_id)
        to_location = None
        to_location_id = serializer.validated_data.get("to_location_id")
        if to_location_id is not None:
            to_location = self.get_location(to_location_id)
        movement = record_inventory_movement(
            CreateInventoryMovementInput(
                organization=self.organization,
                warehouse=warehouse,
                product=product,
                movement_type=serializer.validated_data["movement_type"],
                quantity=serializer.validated_data["quantity"],
                performed_by=serializer.validated_data.get("performed_by") or _actor_name_from_request(request),
                from_location=from_location,
                to_location=to_location,
                stock_status=serializer.validated_data.get("stock_status", InventoryStatus.AVAILABLE),
                lot_number=serializer.validated_data.get("lot_number", ""),
                serial_number=serializer.validated_data.get("serial_number", ""),
                unit_cost=serializer.validated_data.get("unit_cost", Decimal("0.0000")),
                currency=serializer.validated_data.get("currency", "USD"),
                reference_code=serializer.validated_data.get("reference_code", ""),
                reason=serializer.validated_data.get("reason", ""),
                occurred_at=serializer.validated_data.get("occurred_at"),
            )
        )
        return Response(InventoryMovementSerializer(movement).data, status=status.HTTP_201_CREATED)


class InventoryMovementDetailAPIView(OrganizationInventoryBaseAPIView):
    permission_classes = [CanViewInventory]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        movement = get_object_or_404(
            InventoryMovement,
            pk=kwargs["inventory_movement_id"],
            organization=self.organization,
        )
        return Response(InventoryMovementSerializer(movement).data)


class InventoryHoldListCreateAPIView(OrganizationInventoryBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInventory()]
        return [CanManageInventoryRecords()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        product_id = request.query_params.get("product_id")
        is_active = request.query_params.get("is_active")
        holds = list_organization_inventory_holds(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            product_id=int(product_id) if product_id else None,
            is_active=(is_active.lower() == "true") if is_active else None,
        )
        return Response(InventoryHoldSerializer(holds, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = InventoryHoldSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        balance = get_object_or_404(
            InventoryBalance,
            pk=serializer.validated_data["inventory_balance_id"],
            organization=self.organization,
        )
        hold = create_inventory_hold(
            CreateInventoryHoldInput(
                organization=self.organization,
                inventory_balance=balance,
                quantity=serializer.validated_data["quantity"],
                reason=serializer.validated_data["reason"],
                held_by=serializer.validated_data.get("held_by") or _actor_name_from_request(request),
                reference_code=serializer.validated_data.get("reference_code", ""),
                notes=serializer.validated_data.get("notes", ""),
            )
        )
        return Response(InventoryHoldSerializer(hold).data, status=status.HTTP_201_CREATED)


class InventoryHoldDetailAPIView(OrganizationInventoryBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInventory()]
        return [CanManageInventoryRecords()]

    def get_object(self, inventory_hold_id: int) -> InventoryHold:
        return get_object_or_404(InventoryHold, pk=inventory_hold_id, organization=self.organization)

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        hold = self.get_object(kwargs["inventory_hold_id"])
        return Response(InventoryHoldSerializer(hold).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        hold = self.get_object(kwargs["inventory_hold_id"])
        serializer = InventoryHoldSerializer(hold, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        is_active = serializer.validated_data.get("is_active")
        if is_active is False:
            updated = release_inventory_hold(
                hold,
                released_by=serializer.validated_data.get("released_by") or _actor_name_from_request(request),
                notes=serializer.validated_data.get("notes"),
            )
        else:
            updated = update_inventory_hold(
                hold,
                reason=serializer.validated_data.get("reason"),
                reference_code=serializer.validated_data.get("reference_code"),
                notes=serializer.validated_data.get("notes"),
            )
        return Response(InventoryHoldSerializer(updated).data)


class InventoryAdjustmentReasonListCreateAPIView(OrganizationInventoryBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInventory()]
        return [CanManageInventoryConfiguration()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        reasons = list_inventory_adjustment_reasons(organization=self.organization)
        return Response(InventoryAdjustmentReasonSerializer(reasons, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = InventoryAdjustmentReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = create_inventory_adjustment_reason(
            CreateInventoryAdjustmentReasonInput(
                organization=self.organization,
                code=serializer.validated_data["code"],
                name=serializer.validated_data["name"],
                description=serializer.validated_data.get("description", ""),
                direction=serializer.validated_data.get("direction", AdjustmentDirection.BOTH),
                requires_approval=serializer.validated_data.get("requires_approval", False),
                is_active=serializer.validated_data.get("is_active", True),
            )
        )
        return Response(
            InventoryAdjustmentReasonSerializer(reason).data,
            status=status.HTTP_201_CREATED,
        )


class InventoryAdjustmentReasonDetailAPIView(OrganizationInventoryBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInventory()]
        return [CanManageInventoryConfiguration()]

    def get_object(self, inventory_adjustment_reason_id: int) -> InventoryAdjustmentReason:
        return get_object_or_404(
            InventoryAdjustmentReason,
            pk=inventory_adjustment_reason_id,
            organization=self.organization,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        reason = self.get_object(kwargs["inventory_adjustment_reason_id"])
        return Response(InventoryAdjustmentReasonSerializer(reason).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        reason = self.get_object(kwargs["inventory_adjustment_reason_id"])
        serializer = InventoryAdjustmentReasonSerializer(reason, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_inventory_adjustment_reason(
            reason,
            code=serializer.validated_data.get("code"),
            name=serializer.validated_data.get("name"),
            description=serializer.validated_data.get("description"),
            direction=serializer.validated_data.get("direction"),
            requires_approval=serializer.validated_data.get("requires_approval"),
            is_active=serializer.validated_data.get("is_active"),
        )
        return Response(InventoryAdjustmentReasonSerializer(updated).data)


class InventoryAdjustmentApprovalRuleListCreateAPIView(OrganizationInventoryBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInventory()]
        return [CanManageInventoryConfiguration()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        rules = list_inventory_adjustment_approval_rules(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
        )
        return Response(InventoryAdjustmentApprovalRuleSerializer(rules, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = InventoryAdjustmentApprovalRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        adjustment_reason = get_object_or_404(
            InventoryAdjustmentReason,
            pk=serializer.validated_data["adjustment_reason_id"],
            organization=self.organization,
        )
        warehouse = None
        warehouse_id = serializer.validated_data.get("warehouse_id")
        if warehouse_id is not None:
            warehouse = self.get_warehouse(warehouse_id)
        rule = create_inventory_adjustment_approval_rule(
            CreateInventoryAdjustmentApprovalRuleInput(
                organization=self.organization,
                adjustment_reason=adjustment_reason,
                warehouse=warehouse,
                minimum_variance_qty=serializer.validated_data.get("minimum_variance_qty", Decimal("0.0000")),
                approver_role=serializer.validated_data["approver_role"],
                is_active=serializer.validated_data.get("is_active", True),
                notes=serializer.validated_data.get("notes", ""),
            )
        )
        return Response(
            InventoryAdjustmentApprovalRuleSerializer(rule).data,
            status=status.HTTP_201_CREATED,
        )


class InventoryAdjustmentApprovalRuleDetailAPIView(OrganizationInventoryBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInventory()]
        return [CanManageInventoryConfiguration()]

    def get_object(self, inventory_adjustment_approval_rule_id: int) -> InventoryAdjustmentApprovalRule:
        return get_object_or_404(
            InventoryAdjustmentApprovalRule,
            pk=inventory_adjustment_approval_rule_id,
            organization=self.organization,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        rule = self.get_object(kwargs["inventory_adjustment_approval_rule_id"])
        return Response(InventoryAdjustmentApprovalRuleSerializer(rule).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        rule = self.get_object(kwargs["inventory_adjustment_approval_rule_id"])
        serializer = InventoryAdjustmentApprovalRuleSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        adjustment_reason = None
        adjustment_reason_id = serializer.validated_data.get("adjustment_reason_id")
        if adjustment_reason_id is not None:
            adjustment_reason = get_object_or_404(
                InventoryAdjustmentReason,
                pk=adjustment_reason_id,
                organization=self.organization,
            )
        warehouse = rule.warehouse
        if "warehouse_id" in serializer.validated_data:
            warehouse_id = serializer.validated_data.get("warehouse_id")
            warehouse = self.get_warehouse(warehouse_id) if warehouse_id is not None else None
        updated = update_inventory_adjustment_approval_rule(
            rule,
            adjustment_reason=adjustment_reason,
            warehouse=warehouse,
            minimum_variance_qty=serializer.validated_data.get("minimum_variance_qty"),
            approver_role=serializer.validated_data.get("approver_role"),
            is_active=serializer.validated_data.get("is_active"),
            notes=serializer.validated_data.get("notes"),
        )
        return Response(InventoryAdjustmentApprovalRuleSerializer(updated).data)

