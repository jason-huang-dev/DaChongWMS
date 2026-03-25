from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.operation_types import OperationOrderType
from apps.iam.permissions import get_active_membership
from apps.organizations.models import Organization
from apps.outbound.models import SalesOrder
from apps.partners.models import CustomerAccount
from apps.products.models import Product
from apps.returns.models import ReturnDisposition, ReturnLine, ReturnOrder, ReturnReceipt
from apps.returns.permissions import CanManageReturnExecution, CanManageReturnOrders, CanViewReturns
from apps.returns.serializers import ReturnDispositionSerializer, ReturnOrderSerializer, ReturnReceiptSerializer
from apps.returns.services.return_service import (
    CreateReturnDispositionInput,
    CreateReturnLineInput,
    CreateReturnOrderInput,
    CreateReturnReceiptInput,
    create_return_order,
    list_return_dispositions,
    list_return_orders,
    list_return_receipts,
    record_return_disposition,
    record_return_receipt,
)
from apps.warehouse.models import Warehouse
from apps.locations.models import Location


def _actor_name_from_request(request: Request) -> str:
    email = getattr(request.user, "email", "")
    if isinstance(email, str) and email.strip():
        return email.strip()
    return "system"


class OrganizationReturnsBaseAPIView(APIView):
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)

    def get_membership(self):
        return get_active_membership(self.request.user, self.organization)

    def get_warehouse(self, warehouse_id: int) -> Warehouse:
        return get_object_or_404(Warehouse, pk=warehouse_id, organization=self.organization)

    def get_customer_account(self, customer_account_id: int) -> CustomerAccount:
        return get_object_or_404(CustomerAccount, pk=customer_account_id, organization=self.organization)

    def get_sales_order(self, sales_order_id: int) -> SalesOrder:
        return get_object_or_404(SalesOrder, pk=sales_order_id, organization=self.organization)

    def get_product(self, product_id: int) -> Product:
        return get_object_or_404(Product, pk=product_id, organization=self.organization)

    def get_location(self, location_id: int) -> Location:
        return get_object_or_404(Location, pk=location_id, organization=self.organization)

    def get_return_order(self, return_order_id: int) -> ReturnOrder:
        return get_object_or_404(ReturnOrder, pk=return_order_id, organization=self.organization)

    def get_return_line(self, return_line_id: int) -> ReturnLine:
        return get_object_or_404(ReturnLine, pk=return_line_id, organization=self.organization)

    def get_return_receipt(self, return_receipt_id: int) -> ReturnReceipt:
        return get_object_or_404(ReturnReceipt, pk=return_receipt_id, organization=self.organization)


class ReturnOrderListCreateAPIView(OrganizationReturnsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewReturns()]
        return [CanManageReturnOrders()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        order_type = request.query_params.get("order_type")
        status_value = request.query_params.get("status")
        customer_account_id = request.query_params.get("customer_account_id")
        orders = list_return_orders(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            order_type=order_type or None,
            status=status_value or None,
            customer_account_id=int(customer_account_id) if customer_account_id else None,
        )
        return Response(ReturnOrderSerializer(orders, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = ReturnOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sales_order = None
        if serializer.validated_data.get("sales_order_id") is not None:
            sales_order = self.get_sales_order(serializer.validated_data["sales_order_id"])
        line_items = tuple(
            CreateReturnLineInput(
                line_number=item["line_number"],
                product=self.get_product(item["product_id"]),
                expected_qty=item["expected_qty"],
                return_reason=item.get("return_reason", ""),
                notes=item.get("notes", ""),
            )
            for item in serializer.validated_data.get("line_items", [])
        )
        return_order = create_return_order(
            CreateReturnOrderInput(
                organization=self.organization,
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                customer_account=self.get_customer_account(serializer.validated_data["customer_account_id"]),
                sales_order=sales_order,
                order_type=serializer.validated_data.get("order_type", OperationOrderType.STANDARD),
                return_number=serializer.validated_data["return_number"],
                requested_date=serializer.validated_data.get("requested_date"),
                reference_code=serializer.validated_data.get("reference_code", ""),
                notes=serializer.validated_data.get("notes", ""),
                line_items=line_items,
            )
        )
        return Response(ReturnOrderSerializer(return_order).data, status=status.HTTP_201_CREATED)


class ReturnOrderDetailAPIView(OrganizationReturnsBaseAPIView):
    permission_classes = [CanViewReturns]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        return_order = self.get_return_order(kwargs["return_order_id"])
        return Response(ReturnOrderSerializer(return_order).data)


class ReturnReceiptListCreateAPIView(OrganizationReturnsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewReturns()]
        return [CanManageReturnExecution()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        return_order_id = request.query_params.get("return_order_id")
        receipts = list_return_receipts(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            return_order_id=int(return_order_id) if return_order_id else None,
        )
        return Response(ReturnReceiptSerializer(receipts, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = ReturnReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        receipt = record_return_receipt(
            payload=CreateReturnReceiptInput(
                return_line=self.get_return_line(serializer.validated_data["return_line_id"]),
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                receipt_location=self.get_location(serializer.validated_data["receipt_location_id"]),
                receipt_number=serializer.validated_data["receipt_number"],
                received_qty=serializer.validated_data["received_qty"],
                stock_status=serializer.validated_data.get("stock_status", "QUARANTINE"),
                lot_number=serializer.validated_data.get("lot_number", ""),
                serial_number=serializer.validated_data.get("serial_number", ""),
                notes=serializer.validated_data.get("notes", ""),
            ),
            operator_name=_actor_name_from_request(request),
        )
        return Response(ReturnReceiptSerializer(receipt).data, status=status.HTTP_201_CREATED)


class ReturnReceiptDetailAPIView(OrganizationReturnsBaseAPIView):
    permission_classes = [CanViewReturns]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        receipt = self.get_return_receipt(kwargs["return_receipt_id"])
        return Response(ReturnReceiptSerializer(receipt).data)


class ReturnDispositionListCreateAPIView(OrganizationReturnsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewReturns()]
        return [CanManageReturnExecution()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        disposition_type = request.query_params.get("disposition_type")
        dispositions = list_return_dispositions(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            disposition_type=disposition_type or None,
        )
        return Response(ReturnDispositionSerializer(dispositions, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = ReturnDispositionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        to_location = None
        if serializer.validated_data.get("to_location_id") is not None:
            to_location = self.get_location(serializer.validated_data["to_location_id"])
        disposition = record_return_disposition(
            payload=CreateReturnDispositionInput(
                return_receipt=self.get_return_receipt(serializer.validated_data["return_receipt_id"]),
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                disposition_number=serializer.validated_data["disposition_number"],
                disposition_type=serializer.validated_data["disposition_type"],
                quantity=serializer.validated_data["quantity"],
                to_location=to_location,
                notes=serializer.validated_data.get("notes", ""),
            ),
            operator_name=_actor_name_from_request(request),
        )
        return Response(ReturnDispositionSerializer(disposition).data, status=status.HTTP_201_CREATED)


class ReturnDispositionDetailAPIView(OrganizationReturnsBaseAPIView):
    permission_classes = [CanViewReturns]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        disposition = get_object_or_404(ReturnDisposition, pk=kwargs["return_disposition_id"], organization=self.organization)
        return Response(ReturnDispositionSerializer(disposition).data)

