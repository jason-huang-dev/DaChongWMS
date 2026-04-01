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
from apps.outbound.models import SalesOrder, SalesOrderLine


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
