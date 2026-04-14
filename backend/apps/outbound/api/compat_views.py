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
    get_query_values,
    iso_date,
    iso_datetime,
    paginate_compat_list,
)
from apps.outbound.models import PickTask, SalesOrder, SalesOrderLine


def _serialize_sales_order_line(line: SalesOrderLine) -> dict[str, object]:
    return {
        "id": line.id,
        "line_number": line.line_number,
        "goods": line.product_id,
        "goods_code": line.product.sku,
        "ordered_qty": decimal_to_string(line.ordered_qty),
        "allocated_qty": decimal_to_string(line.allocated_qty),
        "picked_qty": decimal_to_string(line.picked_qty),
        "shipped_qty": decimal_to_string(line.shipped_qty),
        "unit_price": decimal_to_string(line.unit_price),
        "stock_status": line.stock_status,
        "status": line.status,
    }


def _serialize_sales_order(order: SalesOrder) -> dict[str, object]:
    return {
        "id": order.id,
        "warehouse": order.warehouse_id,
        "warehouse_name": order.warehouse.name,
        "customer": order.customer_account_id,
        "customer_code": order.customer_code,
        "customer_name": order.customer_name,
        "staging_location": order.staging_location_id,
        "staging_location_code": order.staging_location.code,
        "order_type": order.order_type,
        "order_number": order.order_number,
        "order_time": iso_datetime(order.order_time),
        "requested_ship_date": iso_date(order.requested_ship_date),
        "expires_at": iso_datetime(order.expires_at),
        "status": order.status,
        "fulfillment_stage": order.fulfillment_stage,
        "exception_state": order.exception_state,
        "package_count": order.package_count,
        "package_type": order.package_type,
        "package_weight": decimal_to_string(order.package_weight),
        "package_length": decimal_to_string(order.package_length),
        "package_width": decimal_to_string(order.package_width),
        "package_height": decimal_to_string(order.package_height),
        "package_volume": decimal_to_string(order.package_volume),
        "logistics_provider": order.logistics_provider,
        "shipping_method": order.shipping_method,
        "tracking_number": order.tracking_number,
        "waybill_number": order.waybill_number,
        "waybill_printed": order.waybill_printed,
        "waybill_printed_at": iso_datetime(order.waybill_printed_at),
        "deliverer_name": order.deliverer_name,
        "deliverer_phone": order.deliverer_phone,
        "receiver_name": order.receiver_name,
        "receiver_phone": order.receiver_phone,
        "receiver_country": order.receiver_country,
        "receiver_state": order.receiver_state,
        "receiver_city": order.receiver_city,
        "receiver_address": order.receiver_address,
        "receiver_postal_code": order.receiver_postal_code,
        "picking_started_at": iso_datetime(order.picking_started_at),
        "picking_completed_at": iso_datetime(order.picking_completed_at),
        "packed_at": iso_datetime(order.packed_at),
        "exception_notes": order.exception_notes,
        "reference_code": order.reference_code,
        "notes": order.notes,
        "lines": [_serialize_sales_order_line(line) for line in order.lines.all()],
        "creator": "",
        "create_time": iso_datetime(order.create_time),
        "update_time": iso_datetime(order.update_time),
        "allocated_tasks": sum(line.pick_tasks.count() for line in order.lines.all()),
    }


def _serialize_pick_task(task: PickTask) -> dict[str, object]:
    assigned_to_name = ""
    if task.assigned_membership_id is not None:
        assigned_to_name = task.assigned_membership.user.display_name

    to_location_code = task.to_location.code if task.to_location_id is not None else None

    return {
        "id": task.id,
        "sales_order_line": task.sales_order_line_id,
        "order_number": task.sales_order_line.sales_order.order_number,
        "order_type": task.sales_order_line.sales_order.order_type,
        "warehouse": task.warehouse_id,
        "warehouse_name": task.warehouse.name,
        "goods": task.sales_order_line.product_id,
        "goods_code": task.sales_order_line.product.sku,
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


class CompatibilitySalesOrderListAPIView(APIView):
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
            SalesOrder.objects.select_related("warehouse", "customer_account", "staging_location")
            .prefetch_related(
                Prefetch(
                    "lines",
                    queryset=SalesOrderLine.objects.select_related("product").prefetch_related("pick_tasks").order_by("line_number", "id"),
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
            serializer=_serialize_sales_order,
        )


class CompatibilityPickTaskListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        membership = get_compat_membership(request)
        if membership is None:
            return empty_compat_response(request=request, view=self)

        warehouse_id = get_optional_int(request, "warehouse", "warehouse_id")
        assigned_membership_id = get_optional_int(request, "assigned_to", "assigned_membership_id")
        order_type = request.query_params.get("order_type")
        status_value = request.query_params.get("status")
        status_values = get_query_values(request, "status__in")
        task_number_filter = str(request.query_params.get("task_number__icontains") or "").strip()

        queryset = (
            PickTask.objects.select_related(
                "warehouse",
                "from_location",
                "to_location",
                "assigned_membership__user",
                "sales_order_line__product",
                "sales_order_line__sales_order",
            )
            .filter(organization_id=membership.organization_id)
            .order_by("status", "create_time", "id")
        )
        if warehouse_id is not None:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        if assigned_membership_id is not None:
            queryset = queryset.filter(assigned_membership_id=assigned_membership_id)
        if isinstance(order_type, str) and order_type.strip():
            queryset = queryset.filter(sales_order_line__sales_order__order_type=order_type.strip().upper())
        if isinstance(status_value, str) and status_value.strip():
            queryset = queryset.filter(status=status_value.strip().upper())
        if status_values:
            queryset = queryset.filter(status__in=[value.upper() for value in status_values])
        if task_number_filter:
            queryset = queryset.filter(task_number__icontains=task_number_filter)

        return paginate_compat_list(
            request=request,
            view=self,
            records=queryset,
            serializer=_serialize_pick_task,
        )
