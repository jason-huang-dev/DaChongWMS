from __future__ import annotations

from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization, OrganizationMembership
from apps.products.models import Product
from apps.transfers.models import ReplenishmentRule, ReplenishmentTask, TransferLine, TransferOrder
from apps.transfers.permissions import CanManageReplenishment, CanManageTransferOrders, CanViewTransfers
from apps.transfers.serializers import (
    ReplenishmentGenerateSerializer,
    ReplenishmentRuleSerializer,
    ReplenishmentTaskCompleteSerializer,
    ReplenishmentTaskSerializer,
    TransferLineCompleteSerializer,
    TransferLineSerializer,
    TransferOrderSerializer,
)
from apps.transfers.services.transfer_service import (
    CreateReplenishmentRuleInput,
    CreateTransferLineInput,
    CreateTransferOrderInput,
    complete_replenishment_task,
    complete_transfer_line,
    create_replenishment_rule,
    create_transfer_order,
    generate_replenishment_task,
    list_organization_transfer_lines,
    list_organization_transfer_orders,
    list_replenishment_rules,
    list_replenishment_tasks,
    update_replenishment_rule,
    update_replenishment_task,
    update_transfer_line,
    update_transfer_order,
)
from apps.warehouse.models import Warehouse
from apps.locations.models import Location


def _actor_name_from_request(request: Request) -> str:
    email = getattr(request.user, "email", "")
    if isinstance(email, str) and email.strip():
        return email.strip()
    return "system"


class OrganizationTransfersBaseAPIView(APIView):
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

    def get_membership(self, membership_id: int | None) -> OrganizationMembership | None:
        if membership_id is None:
            return None
        return get_object_or_404(
            OrganizationMembership,
            pk=membership_id,
            organization=self.organization,
        )


class TransferOrderListCreateAPIView(OrganizationTransfersBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewTransfers()]
        return [CanManageTransferOrders()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        status_value = request.query_params.get("status")
        orders = list_organization_transfer_orders(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            status=status_value or None,
        )
        return Response(TransferOrderSerializer(orders, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = TransferOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        line_items = []
        for item in serializer.validated_data.get("line_items", []):
            line_items.append(
                CreateTransferLineInput(
                    line_number=item["line_number"],
                    product=self.get_product(item["product_id"]),
                    from_location=self.get_location(item["from_location_id"]),
                    to_location=self.get_location(item["to_location_id"]),
                    requested_qty=item["requested_qty"],
                    stock_status=item.get("stock_status", "AVAILABLE"),
                    lot_number=item.get("lot_number", ""),
                    serial_number=item.get("serial_number", ""),
                    notes=item.get("notes", ""),
                    assigned_membership=self.get_membership(item.get("assigned_membership_id")),
                )
            )
        transfer_order = create_transfer_order(
            CreateTransferOrderInput(
                organization=self.organization,
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                transfer_number=serializer.validated_data["transfer_number"],
                requested_date=serializer.validated_data.get("requested_date"),
                reference_code=serializer.validated_data.get("reference_code", ""),
                notes=serializer.validated_data.get("notes", ""),
                line_items=tuple(line_items),
            )
        )
        return Response(TransferOrderSerializer(transfer_order).data, status=status.HTTP_201_CREATED)


class TransferOrderDetailAPIView(OrganizationTransfersBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewTransfers()]
        return [CanManageTransferOrders()]

    def get_object(self, transfer_order_id: int) -> TransferOrder:
        return get_object_or_404(
            TransferOrder,
            pk=transfer_order_id,
            organization=self.organization,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        transfer_order = self.get_object(kwargs["transfer_order_id"])
        return Response(TransferOrderSerializer(transfer_order).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        transfer_order = self.get_object(kwargs["transfer_order_id"])
        serializer = TransferOrderSerializer(transfer_order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_kwargs: dict[str, object] = {}
        for field_name in ("requested_date", "reference_code", "notes", "status"):
            if field_name in serializer.validated_data:
                update_kwargs[field_name] = serializer.validated_data[field_name]
        updated = update_transfer_order(
            transfer_order,
            **update_kwargs,
        )
        return Response(TransferOrderSerializer(updated).data)


class TransferLineListAPIView(OrganizationTransfersBaseAPIView):
    permission_classes = [CanViewTransfers]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        transfer_order_id = request.query_params.get("transfer_order_id")
        warehouse_id = request.query_params.get("warehouse_id")
        status_value = request.query_params.get("status")
        assigned_membership_id = request.query_params.get("assigned_membership_id")
        lines = list_organization_transfer_lines(
            organization=self.organization,
            transfer_order_id=int(transfer_order_id) if transfer_order_id else None,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            status=status_value or None,
            assigned_membership_id=int(assigned_membership_id) if assigned_membership_id else None,
        )
        return Response(TransferLineSerializer(lines, many=True).data)


class TransferLineDetailAPIView(OrganizationTransfersBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewTransfers()]
        return [CanManageTransferOrders()]

    def get_object(self, transfer_line_id: int) -> TransferLine:
        return get_object_or_404(TransferLine, pk=transfer_line_id, organization=self.organization)

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        line = self.get_object(kwargs["transfer_line_id"])
        return Response(TransferLineSerializer(line).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        line = self.get_object(kwargs["transfer_line_id"])
        serializer = TransferLineSerializer(line, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_kwargs: dict[str, object] = {}
        if "to_location_id" in serializer.validated_data:
            update_kwargs["to_location"] = self.get_location(serializer.validated_data["to_location_id"])
        if "assigned_membership_id" in serializer.validated_data:
            update_kwargs["assigned_membership"] = self.get_membership(serializer.validated_data["assigned_membership_id"])
        if "status" in serializer.validated_data:
            update_kwargs["status"] = serializer.validated_data["status"]
        if "notes" in serializer.validated_data:
            update_kwargs["notes"] = serializer.validated_data["notes"]
        updated = update_transfer_line(
            line,
            **update_kwargs,
        )
        return Response(TransferLineSerializer(updated).data)


class TransferLineCompleteAPIView(OrganizationTransfersBaseAPIView):
    permission_classes = [CanManageTransferOrders]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        line = get_object_or_404(TransferLine, pk=kwargs["transfer_line_id"], organization=self.organization)
        serializer = TransferLineCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        to_location = None
        if "to_location_id" in serializer.validated_data:
            to_location = self.get_location(serializer.validated_data["to_location_id"])
        updated = complete_transfer_line(
            line,
            operator_name=_actor_name_from_request(request),
            to_location=to_location,
        )
        return Response(TransferLineSerializer(updated).data)


class ReplenishmentRuleListCreateAPIView(OrganizationTransfersBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewTransfers()]
        return [CanManageReplenishment()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        product_id = request.query_params.get("product_id")
        is_active = request.query_params.get("is_active")
        rules = list_replenishment_rules(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            product_id=int(product_id) if product_id else None,
            is_active=(is_active.lower() == "true") if is_active else None,
        )
        return Response(ReplenishmentRuleSerializer(rules, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = ReplenishmentRuleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = create_replenishment_rule(
            CreateReplenishmentRuleInput(
                organization=self.organization,
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                product=self.get_product(serializer.validated_data["product_id"]),
                source_location=self.get_location(serializer.validated_data["source_location_id"]),
                target_location=self.get_location(serializer.validated_data["target_location_id"]),
                minimum_qty=serializer.validated_data["minimum_qty"],
                target_qty=serializer.validated_data["target_qty"],
                stock_status=serializer.validated_data.get("stock_status", "AVAILABLE"),
                priority=serializer.validated_data.get("priority", 100),
                is_active=serializer.validated_data.get("is_active", True),
                notes=serializer.validated_data.get("notes", ""),
            )
        )
        return Response(ReplenishmentRuleSerializer(rule).data, status=status.HTTP_201_CREATED)


class ReplenishmentRuleDetailAPIView(OrganizationTransfersBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewTransfers()]
        return [CanManageReplenishment()]

    def get_object(self, replenishment_rule_id: int) -> ReplenishmentRule:
        return get_object_or_404(ReplenishmentRule, pk=replenishment_rule_id, organization=self.organization)

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        rule = self.get_object(kwargs["replenishment_rule_id"])
        return Response(ReplenishmentRuleSerializer(rule).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        rule = self.get_object(kwargs["replenishment_rule_id"])
        serializer = ReplenishmentRuleSerializer(rule, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_kwargs: dict[str, object] = {}
        if "warehouse_id" in serializer.validated_data:
            update_kwargs["warehouse"] = self.get_warehouse(serializer.validated_data["warehouse_id"])
        if "product_id" in serializer.validated_data:
            update_kwargs["product"] = self.get_product(serializer.validated_data["product_id"])
        if "source_location_id" in serializer.validated_data:
            update_kwargs["source_location"] = self.get_location(serializer.validated_data["source_location_id"])
        if "target_location_id" in serializer.validated_data:
            update_kwargs["target_location"] = self.get_location(serializer.validated_data["target_location_id"])
        for field_name in ("minimum_qty", "target_qty", "stock_status", "priority", "is_active", "notes"):
            if field_name in serializer.validated_data:
                update_kwargs[field_name] = serializer.validated_data[field_name]
        updated = update_replenishment_rule(
            rule,
            **update_kwargs,
        )
        return Response(ReplenishmentRuleSerializer(updated).data)


class ReplenishmentRuleGenerateTaskAPIView(OrganizationTransfersBaseAPIView):
    permission_classes = [CanManageReplenishment]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        rule = get_object_or_404(ReplenishmentRule, pk=kwargs["replenishment_rule_id"], organization=self.organization)
        serializer = ReplenishmentGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        task = generate_replenishment_task(
            rule,
            assigned_membership=self.get_membership(serializer.validated_data.get("assigned_membership_id")),
        )
        return Response(ReplenishmentTaskSerializer(task).data, status=status.HTTP_201_CREATED)


class ReplenishmentTaskListAPIView(OrganizationTransfersBaseAPIView):
    permission_classes = [CanViewTransfers]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        status_value = request.query_params.get("status")
        assigned_membership_id = request.query_params.get("assigned_membership_id")
        tasks = list_replenishment_tasks(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            status=status_value or None,
            assigned_membership_id=int(assigned_membership_id) if assigned_membership_id else None,
        )
        return Response(ReplenishmentTaskSerializer(tasks, many=True).data)


class ReplenishmentTaskDetailAPIView(OrganizationTransfersBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewTransfers()]
        return [CanManageReplenishment()]

    def get_object(self, replenishment_task_id: int) -> ReplenishmentTask:
        return get_object_or_404(ReplenishmentTask, pk=replenishment_task_id, organization=self.organization)

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        task = self.get_object(kwargs["replenishment_task_id"])
        return Response(ReplenishmentTaskSerializer(task).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        task = self.get_object(kwargs["replenishment_task_id"])
        serializer = ReplenishmentTaskSerializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_kwargs: dict[str, object] = {}
        if "to_location_id" in serializer.validated_data:
            update_kwargs["to_location"] = self.get_location(serializer.validated_data["to_location_id"])
        if "assigned_membership_id" in serializer.validated_data:
            update_kwargs["assigned_membership"] = self.get_membership(serializer.validated_data["assigned_membership_id"])
        if "status" in serializer.validated_data:
            update_kwargs["status"] = serializer.validated_data["status"]
        if "notes" in serializer.validated_data:
            update_kwargs["notes"] = serializer.validated_data["notes"]
        updated = update_replenishment_task(
            task,
            **update_kwargs,
        )
        return Response(ReplenishmentTaskSerializer(updated).data)


class ReplenishmentTaskCompleteAPIView(OrganizationTransfersBaseAPIView):
    permission_classes = [CanManageReplenishment]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        task = get_object_or_404(ReplenishmentTask, pk=kwargs["replenishment_task_id"], organization=self.organization)
        serializer = ReplenishmentTaskCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        to_location = None
        if "to_location_id" in serializer.validated_data:
            to_location = self.get_location(serializer.validated_data["to_location_id"])
        updated = complete_replenishment_task(
            task,
            operator_name=_actor_name_from_request(request),
            to_location=to_location,
        )
        return Response(ReplenishmentTaskSerializer(updated).data)
