from __future__ import annotations

from django.db.models import Prefetch
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.api_compat import (
    decimal_to_string,
    empty_compat_response,
    get_compat_membership,
    get_optional_int,
    iso_date,
    iso_datetime,
    paginate_compat_list,
)
from apps.inbound.models import PurchaseOrder, PurchaseOrderLine, PutawayTask


def _serialize_purchase_order_line(line: PurchaseOrderLine) -> dict[str, object]:
    return {
        "id": line.id,
        "line_number": line.line_number,
        "goods": line.product_id,
        "goods_code": line.product.sku,
        "ordered_qty": decimal_to_string(line.ordered_qty),
        "received_qty": decimal_to_string(line.received_qty),
        "unit_cost": decimal_to_string(line.unit_cost),
        "stock_status": line.stock_status,
        "status": line.status,
    }


def _serialize_purchase_order(purchase_order: PurchaseOrder) -> dict[str, object]:
    return {
        "id": purchase_order.id,
        "warehouse": purchase_order.warehouse_id,
        "warehouse_name": purchase_order.warehouse.name,
        "supplier": purchase_order.customer_account_id,
        "supplier_name": purchase_order.supplier_name,
        "customer_code": purchase_order.customer_code,
        "customer_name": purchase_order.customer_name,
        "order_type": purchase_order.order_type,
        "po_number": purchase_order.po_number,
        "expected_arrival_date": iso_date(purchase_order.expected_arrival_date),
        "status": purchase_order.status,
        "reference_code": purchase_order.reference_code,
        "notes": purchase_order.notes,
        "lines": [_serialize_purchase_order_line(line) for line in purchase_order.lines.all()],
        "creator": "",
        "create_time": iso_datetime(purchase_order.create_time),
        "update_time": iso_datetime(purchase_order.update_time),
    }


def _serialize_putaway_task(task: PutawayTask) -> dict[str, object]:
    assigned_to_name = ""
    if task.assigned_membership_id is not None:
        assigned_to_name = task.assigned_membership.user.display_name

    to_location_code = task.to_location.code if task.to_location_id is not None else ""

    return {
        "id": task.id,
        "receipt_line": task.receipt_line_id,
        "receipt_number": task.receipt_line.receipt.receipt_number,
        "order_type": task.receipt_line.receipt.purchase_order.order_type,
        "warehouse": task.warehouse_id,
        "warehouse_name": task.warehouse.name,
        "goods": task.product_id,
        "goods_code": task.product.sku,
        "task_number": task.task_number,
        "from_location": task.from_location_id,
        "from_location_code": task.from_location.code,
        "to_location": task.to_location_id,
        "to_location_code": to_location_code,
        "quantity": decimal_to_string(task.quantity),
        "stock_status": task.stock_status,
        "lot_number": task.lot_number,
        "serial_number": task.serial_number,
        "status": task.status,
        "assigned_to": task.assigned_membership_id,
        "assigned_to_name": assigned_to_name,
        "completed_by": task.completed_by,
        "completed_at": iso_datetime(task.completed_at),
        "inventory_movement": task.inventory_movement_id,
        "license_plate": None,
        "license_plate_code": "",
        "notes": task.notes,
        "create_time": iso_datetime(task.create_time),
        "update_time": iso_datetime(task.update_time),
    }


class CompatibilityPurchaseOrderListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        membership = get_compat_membership(request)
        if membership is None:
            return empty_compat_response(request=request, view=self)

        warehouse_id = get_optional_int(request, "warehouse", "warehouse_id")
        customer_account_id = get_optional_int(request, "customer", "customer_account", "customer_account_id")
        order_type = request.query_params.get("order_type")
        status_value = request.query_params.get("status")

        queryset = (
            PurchaseOrder.objects.select_related("warehouse", "customer_account")
            .prefetch_related(
                Prefetch(
                    "lines",
                    queryset=PurchaseOrderLine.objects.select_related("product").order_by("line_number", "id"),
                )
            )
            .filter(organization_id=membership.organization_id)
            .order_by("-create_time", "-id")
        )
        if warehouse_id is not None:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        if customer_account_id is not None:
            queryset = queryset.filter(customer_account_id=customer_account_id)
        if isinstance(order_type, str) and order_type.strip():
            queryset = queryset.filter(order_type=order_type.strip().upper())
        if isinstance(status_value, str) and status_value.strip():
            queryset = queryset.filter(status=status_value.strip().upper())

        return paginate_compat_list(
            request=request,
            view=self,
            records=queryset,
            serializer=_serialize_purchase_order,
        )


class CompatibilityPutawayTaskListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        membership = get_compat_membership(request)
        if membership is None:
            return empty_compat_response(request=request, view=self)

        warehouse_id = get_optional_int(request, "warehouse", "warehouse_id")
        assigned_membership_id = get_optional_int(request, "assigned_to", "assigned_membership_id")
        status_value = request.query_params.get("status")

        queryset = (
            PutawayTask.objects.select_related(
                "warehouse",
                "product",
                "from_location",
                "to_location",
                "assigned_membership__user",
                "receipt_line__receipt",
                "receipt_line__receipt__purchase_order",
            )
            .filter(organization_id=membership.organization_id)
            .order_by("status", "create_time", "id")
        )
        if warehouse_id is not None:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        if assigned_membership_id is not None:
            queryset = queryset.filter(assigned_membership_id=assigned_membership_id)
        if isinstance(status_value, str) and status_value.strip():
            queryset = queryset.filter(status=status_value.strip().upper())

        return paginate_compat_list(
            request=request,
            view=self,
            records=queryset,
            serializer=_serialize_putaway_task,
        )
