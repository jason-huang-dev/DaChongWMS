from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.operation_types import OperationOrderType
from apps.iam.permissions import get_active_membership
from apps.organizations.models import Organization, OrganizationMembership
from apps.outbound.models import PickTask, SalesOrder, Shipment
from apps.outbound.permissions import CanManageOutboundExecution, CanManageOutboundOrders, CanViewOutbound
from apps.outbound.serializers import (
    PickTaskCompleteSerializer,
    PickTaskSerializer,
    SalesOrderSerializer,
    ShipmentCreateSerializer,
    ShipmentSerializer,
)
from apps.outbound.services.outbound_service import (
    CreateSalesOrderInput,
    CreateSalesOrderLineInput,
    CreateShipmentInput,
    allocate_sales_order,
    complete_pick_task,
    create_sales_order,
    create_shipment,
    list_pick_tasks,
    list_sales_orders,
    list_shipments,
    update_sales_order,
)
from apps.partners.models import CustomerAccount
from apps.products.models import Product
from apps.warehouse.models import Warehouse
from apps.locations.models import Location


def _actor_name_from_request(request: Request) -> str:
    email = getattr(request.user, "email", "")
    if isinstance(email, str) and email.strip():
        return email.strip()
    return "system"


class OrganizationOutboundBaseAPIView(APIView):
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)

    def get_membership(self) -> OrganizationMembership | None:
        return get_active_membership(self.request.user, self.organization)

    def get_warehouse(self, warehouse_id: int) -> Warehouse:
        return get_object_or_404(Warehouse, pk=warehouse_id, organization=self.organization)

    def get_customer_account(self, customer_account_id: int) -> CustomerAccount:
        return get_object_or_404(CustomerAccount, pk=customer_account_id, organization=self.organization)

    def get_product(self, product_id: int) -> Product:
        return get_object_or_404(Product, pk=product_id, organization=self.organization)

    def get_location(self, location_id: int) -> Location:
        return get_object_or_404(Location, pk=location_id, organization=self.organization)


class SalesOrderListCreateAPIView(OrganizationOutboundBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewOutbound()]
        return [CanManageOutboundOrders()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        order_type = request.query_params.get("order_type")
        status_value = request.query_params.get("status")
        customer_account_id = request.query_params.get("customer_account_id")
        orders = list_sales_orders(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            order_type=order_type or None,
            status=status_value or None,
            customer_account_id=int(customer_account_id) if customer_account_id else None,
        )
        return Response(SalesOrderSerializer(orders, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = SalesOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        customer_account = self.get_customer_account(serializer.validated_data["customer_account_id"])
        line_items = tuple(
            CreateSalesOrderLineInput(
                line_number=item["line_number"],
                product=self.get_product(item["product_id"]),
                ordered_qty=item["ordered_qty"],
                unit_price=item.get("unit_price", 0),
                stock_status=item.get("stock_status", "AVAILABLE"),
            )
            for item in serializer.validated_data.get("line_items", [])
        )
        order = create_sales_order(
            CreateSalesOrderInput(
                organization=self.organization,
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                customer_account=customer_account,
                staging_location=self.get_location(serializer.validated_data["staging_location_id"]),
                order_type=serializer.validated_data.get("order_type", OperationOrderType.DROPSHIP),
                order_number=serializer.validated_data["order_number"],
                order_time=serializer.validated_data.get("order_time"),
                requested_ship_date=serializer.validated_data.get("requested_ship_date"),
                expires_at=serializer.validated_data.get("expires_at"),
                reference_code=serializer.validated_data.get("reference_code", ""),
                package_count=serializer.validated_data.get("package_count", 0),
                package_type=serializer.validated_data.get("package_type", ""),
                package_weight=serializer.validated_data.get("package_weight", 0),
                package_length=serializer.validated_data.get("package_length", 0),
                package_width=serializer.validated_data.get("package_width", 0),
                package_height=serializer.validated_data.get("package_height", 0),
                package_volume=serializer.validated_data.get("package_volume", 0),
                logistics_provider=serializer.validated_data.get("logistics_provider", ""),
                shipping_method=serializer.validated_data.get("shipping_method", ""),
                tracking_number=serializer.validated_data.get("tracking_number", ""),
                waybill_number=serializer.validated_data.get("waybill_number", ""),
                waybill_printed=serializer.validated_data.get("waybill_printed", False),
                deliverer_name=serializer.validated_data.get("deliverer_name", ""),
                deliverer_phone=serializer.validated_data.get("deliverer_phone", ""),
                receiver_name=serializer.validated_data.get("receiver_name", ""),
                receiver_phone=serializer.validated_data.get("receiver_phone", ""),
                receiver_country=serializer.validated_data.get("receiver_country", ""),
                receiver_state=serializer.validated_data.get("receiver_state", ""),
                receiver_city=serializer.validated_data.get("receiver_city", ""),
                receiver_address=serializer.validated_data.get("receiver_address", ""),
                receiver_postal_code=serializer.validated_data.get("receiver_postal_code", ""),
                exception_state=serializer.validated_data.get("exception_state", "NORMAL"),
                exception_notes=serializer.validated_data.get("exception_notes", ""),
                notes=serializer.validated_data.get("notes", ""),
                line_items=line_items,
            )
        )
        return Response(SalesOrderSerializer(order).data, status=status.HTTP_201_CREATED)


class SalesOrderDetailAPIView(OrganizationOutboundBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewOutbound()]
        return [CanManageOutboundOrders()]

    def get_object(self, sales_order_id: int) -> SalesOrder:
        return get_object_or_404(SalesOrder, pk=sales_order_id, organization=self.organization)

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        order = self.get_object(kwargs["sales_order_id"])
        return Response(SalesOrderSerializer(order).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        order = self.get_object(kwargs["sales_order_id"])
        serializer = SalesOrderSerializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_kwargs: dict[str, object] = {}
        if "customer_account_id" in serializer.validated_data:
            update_kwargs["customer_account"] = self.get_customer_account(serializer.validated_data["customer_account_id"])
        for field_name in (
            "reference_code",
            "tracking_number",
            "waybill_number",
            "waybill_printed",
            "packed_at",
            "notes",
            "exception_state",
            "exception_notes",
        ):
            if field_name in serializer.validated_data:
                update_kwargs[field_name] = serializer.validated_data[field_name]
        updated = update_sales_order(order, **update_kwargs)
        return Response(SalesOrderSerializer(updated).data)


class SalesOrderAllocateAPIView(OrganizationOutboundBaseAPIView):
    permission_classes = [CanManageOutboundExecution]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        order = get_object_or_404(SalesOrder, pk=kwargs["sales_order_id"], organization=self.organization)
        allocated = allocate_sales_order(order)
        return Response(SalesOrderSerializer(allocated).data)


class SalesOrderShipAPIView(OrganizationOutboundBaseAPIView):
    permission_classes = [CanManageOutboundExecution]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        order = get_object_or_404(SalesOrder, pk=kwargs["sales_order_id"], organization=self.organization)
        serializer = ShipmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shipment = create_shipment(
            order,
            payload=CreateShipmentInput(
                shipment_number=serializer.validated_data["shipment_number"],
            ),
            operator_name=_actor_name_from_request(request),
        )
        return Response(ShipmentSerializer(shipment).data, status=status.HTTP_201_CREATED)


class PickTaskListAPIView(OrganizationOutboundBaseAPIView):
    permission_classes = [CanViewOutbound]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        status_value = request.query_params.get("status")
        assigned_membership_id = request.query_params.get("assigned_membership_id")
        tasks = list_pick_tasks(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            status=status_value or None,
            assigned_membership_id=int(assigned_membership_id) if assigned_membership_id else None,
        )
        return Response(PickTaskSerializer(tasks, many=True).data)


class PickTaskDetailAPIView(OrganizationOutboundBaseAPIView):
    permission_classes = [CanViewOutbound]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        task = get_object_or_404(PickTask, pk=kwargs["pick_task_id"], organization=self.organization)
        return Response(PickTaskSerializer(task).data)


class PickTaskCompleteAPIView(OrganizationOutboundBaseAPIView):
    permission_classes = [CanManageOutboundExecution]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership()
        task = get_object_or_404(PickTask, pk=kwargs["pick_task_id"], organization=self.organization)
        serializer = PickTaskCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        to_location = None
        if "to_location_id" in serializer.validated_data:
            to_location = self.get_location(serializer.validated_data["to_location_id"])
        completed = complete_pick_task(
            task,
            operator_name=_actor_name_from_request(request),
            membership=membership,
            to_location=to_location,
        )
        return Response(PickTaskSerializer(completed).data)


class ShipmentListAPIView(OrganizationOutboundBaseAPIView):
    permission_classes = [CanViewOutbound]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        order_type = request.query_params.get("order_type")
        shipments = list_shipments(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            order_type=order_type or None,
        )
        return Response(ShipmentSerializer(shipments, many=True).data)


class ShipmentDetailAPIView(OrganizationOutboundBaseAPIView):
    permission_classes = [CanViewOutbound]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        shipment = get_object_or_404(Shipment, pk=kwargs["shipment_id"], organization=self.organization)
        return Response(ShipmentSerializer(shipment).data)
