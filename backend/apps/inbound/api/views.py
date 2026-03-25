from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.iam.permissions import get_active_membership
from apps.inbound.models import AdvanceShipmentNotice, AdvanceShipmentNoticeLine, PurchaseOrder, PurchaseOrderLine, PutawayTask, Receipt
from apps.inbound.permissions import CanManageInboundExecution, CanManageInboundOrders, CanViewInbound
from apps.inbound.serializers import (
    AdvanceShipmentNoticeSerializer,
    PurchaseOrderSerializer,
    PutawayTaskCompleteSerializer,
    PutawayTaskSerializer,
    ReceiptSerializer,
)
from apps.inbound.services.inbound_service import (
    CreateAdvanceShipmentNoticeInput,
    CreateAdvanceShipmentNoticeLineInput,
    CreatePurchaseOrderInput,
    CreatePurchaseOrderLineInput,
    CreateReceiptInput,
    ReceiptLineInput,
    complete_putaway_task,
    create_asn,
    create_purchase_order,
    list_asns,
    list_purchase_orders,
    list_putaway_tasks,
    list_receipts,
    record_receipt,
)
from apps.organizations.models import Organization, OrganizationMembership
from apps.partners.models import CustomerAccount
from apps.products.models import Product
from apps.warehouse.models import Warehouse
from apps.locations.models import Location


def _actor_name_from_request(request: Request) -> str:
    email = getattr(request.user, "email", "")
    if isinstance(email, str) and email.strip():
        return email.strip()
    return "system"


class OrganizationInboundBaseAPIView(APIView):
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

    def get_purchase_order(self, purchase_order_id: int) -> PurchaseOrder:
        return get_object_or_404(PurchaseOrder, pk=purchase_order_id, organization=self.organization)

    def get_purchase_order_line(self, purchase_order_line_id: int) -> PurchaseOrderLine:
        return get_object_or_404(PurchaseOrderLine, pk=purchase_order_line_id, organization=self.organization)

    def get_asn(self, asn_id: int) -> AdvanceShipmentNotice:
        return get_object_or_404(AdvanceShipmentNotice, pk=asn_id, organization=self.organization)

    def get_asn_line(self, asn_line_id: int) -> AdvanceShipmentNoticeLine:
        return get_object_or_404(AdvanceShipmentNoticeLine, pk=asn_line_id, organization=self.organization)


class PurchaseOrderListCreateAPIView(OrganizationInboundBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInbound()]
        return [CanManageInboundOrders()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        order_type = request.query_params.get("order_type")
        status_value = request.query_params.get("status")
        customer_account_id = request.query_params.get("customer_account_id")
        purchase_orders = list_purchase_orders(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            order_type=order_type or None,
            status=status_value or None,
            customer_account_id=int(customer_account_id) if customer_account_id else None,
        )
        return Response(PurchaseOrderSerializer(purchase_orders, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = PurchaseOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        line_items = tuple(
            CreatePurchaseOrderLineInput(
                line_number=item["line_number"],
                product=self.get_product(item["product_id"]),
                ordered_qty=item["ordered_qty"],
                unit_cost=item.get("unit_cost", 0),
                stock_status=item.get("stock_status", "AVAILABLE"),
            )
            for item in serializer.validated_data.get("line_items", [])
        )
        purchase_order = create_purchase_order(
            CreatePurchaseOrderInput(
                organization=self.organization,
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                customer_account=self.get_customer_account(serializer.validated_data["customer_account_id"]),
                order_type=serializer.validated_data.get("order_type", "STANDARD"),
                po_number=serializer.validated_data["po_number"],
                supplier_code=serializer.validated_data.get("supplier_code", ""),
                supplier_name=serializer.validated_data.get("supplier_name", ""),
                supplier_contact_name=serializer.validated_data.get("supplier_contact_name", ""),
                supplier_contact_phone=serializer.validated_data.get("supplier_contact_phone", ""),
                expected_arrival_date=serializer.validated_data.get("expected_arrival_date"),
                reference_code=serializer.validated_data.get("reference_code", ""),
                notes=serializer.validated_data.get("notes", ""),
                line_items=line_items,
            )
        )
        return Response(PurchaseOrderSerializer(purchase_order).data, status=status.HTTP_201_CREATED)


class PurchaseOrderDetailAPIView(OrganizationInboundBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInbound()]
        return [CanManageInboundOrders()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        purchase_order = self.get_purchase_order(kwargs["purchase_order_id"])
        return Response(PurchaseOrderSerializer(purchase_order).data)


class AdvanceShipmentNoticeListCreateAPIView(OrganizationInboundBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInbound()]
        return [CanManageInboundOrders()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        purchase_order_id = request.query_params.get("purchase_order_id")
        status_value = request.query_params.get("status")
        asns = list_asns(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            purchase_order_id=int(purchase_order_id) if purchase_order_id else None,
            status=status_value or None,
        )
        return Response(AdvanceShipmentNoticeSerializer(asns, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = AdvanceShipmentNoticeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_order = self.get_purchase_order(serializer.validated_data["purchase_order_id"])
        line_items = tuple(
            CreateAdvanceShipmentNoticeLineInput(
                line_number=item["line_number"],
                purchase_order_line=self.get_purchase_order_line(item["purchase_order_line_id"]),
                expected_qty=item["expected_qty"],
                stock_status=item.get("stock_status", "AVAILABLE"),
                expected_lpn_code=item.get("expected_lpn_code", ""),
                notes=item.get("notes", ""),
            )
            for item in serializer.validated_data.get("line_items", [])
        )
        asn = create_asn(
            CreateAdvanceShipmentNoticeInput(
                purchase_order=purchase_order,
                asn_number=serializer.validated_data["asn_number"],
                expected_arrival_date=serializer.validated_data.get("expected_arrival_date"),
                reference_code=serializer.validated_data.get("reference_code", ""),
                notes=serializer.validated_data.get("notes", ""),
                line_items=line_items,
            )
        )
        return Response(AdvanceShipmentNoticeSerializer(asn).data, status=status.HTTP_201_CREATED)


class AdvanceShipmentNoticeDetailAPIView(OrganizationInboundBaseAPIView):
    permission_classes = [CanViewInbound]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        asn = self.get_asn(kwargs["asn_id"])
        return Response(AdvanceShipmentNoticeSerializer(asn).data)


class ReceiptListCreateAPIView(OrganizationInboundBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewInbound()]
        return [CanManageInboundExecution()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        purchase_order_id = request.query_params.get("purchase_order_id")
        receipts = list_receipts(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            purchase_order_id=int(purchase_order_id) if purchase_order_id else None,
        )
        return Response(ReceiptSerializer(receipts, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = ReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        line_items = tuple(
            ReceiptLineInput(
                purchase_order_line=self.get_purchase_order_line(item["purchase_order_line_id"]),
                asn_line=self.get_asn_line(item["asn_line_id"]) if item.get("asn_line_id") is not None else None,
                received_qty=item["received_qty"],
                stock_status=item.get("stock_status", "AVAILABLE"),
                lot_number=item.get("lot_number", ""),
                serial_number=item.get("serial_number", ""),
                unit_cost=item.get("unit_cost", 0),
            )
            for item in serializer.validated_data.get("line_items", [])
        )
        receipt = record_receipt(
            payload=CreateReceiptInput(
                purchase_order=self.get_purchase_order(serializer.validated_data["purchase_order_id"]),
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                receipt_location=self.get_location(serializer.validated_data["receipt_location_id"]),
                receipt_number=serializer.validated_data["receipt_number"],
                asn=self.get_asn(serializer.validated_data["asn_id"]) if serializer.validated_data.get("asn_id") is not None else None,
                reference_code=serializer.validated_data.get("reference_code", ""),
                notes=serializer.validated_data.get("notes", ""),
                line_items=line_items,
            ),
            operator_name=_actor_name_from_request(request),
        )
        return Response(ReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)


class ReceiptDetailAPIView(OrganizationInboundBaseAPIView):
    permission_classes = [CanViewInbound]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        receipt = get_object_or_404(Receipt, pk=kwargs["receipt_id"], organization=self.organization)
        return Response(ReceiptSerializer(receipt).data)


class PutawayTaskListAPIView(OrganizationInboundBaseAPIView):
    permission_classes = [CanViewInbound]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        status_value = request.query_params.get("status")
        assigned_membership_id = request.query_params.get("assigned_membership_id")
        tasks = list_putaway_tasks(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            status=status_value or None,
            assigned_membership_id=int(assigned_membership_id) if assigned_membership_id else None,
        )
        return Response(PutawayTaskSerializer(tasks, many=True).data)


class PutawayTaskDetailAPIView(OrganizationInboundBaseAPIView):
    permission_classes = [CanViewInbound]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        task = get_object_or_404(PutawayTask, pk=kwargs["putaway_task_id"], organization=self.organization)
        return Response(PutawayTaskSerializer(task).data)


class PutawayTaskCompleteAPIView(OrganizationInboundBaseAPIView):
    permission_classes = [CanManageInboundExecution]

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = self.get_membership()
        task = get_object_or_404(PutawayTask, pk=kwargs["putaway_task_id"], organization=self.organization)
        serializer = PutawayTaskCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        to_location = None
        if "to_location_id" in serializer.validated_data:
            to_location = self.get_location(serializer.validated_data["to_location_id"])
        completed = complete_putaway_task(
            task,
            operator_name=_actor_name_from_request(request),
            membership=membership,
            to_location=to_location,
        )
        return Response(PutawayTaskSerializer(completed).data)
