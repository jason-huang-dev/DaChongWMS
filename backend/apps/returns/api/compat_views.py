from __future__ import annotations

from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
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
from apps.returns.models import ReturnLine, ReturnOrder


def _return_order_queryset(organization_id: int):
    return (
        ReturnOrder.objects.select_related("organization", "warehouse", "customer_account", "sales_order")
        .prefetch_related(
            Prefetch(
                "lines",
                queryset=ReturnLine.objects.select_related("product").order_by("line_number", "id"),
            )
        )
        .filter(organization_id=organization_id)
        .order_by("-create_time", "-id")
    )


def _serialize_return_line(line: ReturnLine) -> dict[str, object]:
    return {
        "id": line.id,
        "line_number": line.line_number,
        "goods": line.product_id,
        "goods_code": line.product.sku,
        "expected_qty": decimal_to_string(line.expected_qty),
        "received_qty": decimal_to_string(line.received_qty),
        "disposed_qty": decimal_to_string(line.disposed_qty),
        "status": line.status,
        "return_reason": line.return_reason,
        "notes": line.notes,
    }


def _serialize_return_order(order: ReturnOrder) -> dict[str, object]:
    sales_order_number = ""
    if order.sales_order_id is not None:
        sales_order_number = order.sales_order.order_number

    return {
        "id": order.id,
        "warehouse": order.warehouse_id,
        "warehouse_name": order.warehouse.name,
        "customer": order.customer_account_id,
        "customer_name": order.customer_name,
        "sales_order": order.sales_order_id,
        "sales_order_number": sales_order_number,
        "return_number": order.return_number,
        "requested_date": iso_date(order.requested_date),
        "reference_code": order.reference_code,
        "status": order.status,
        "notes": order.notes,
        "lines": [_serialize_return_line(line) for line in order.lines.all()],
        "creator": "",
        "openid": order.organization.slug,
        "create_time": iso_datetime(order.create_time),
        "update_time": iso_datetime(order.update_time),
    }


class CompatibilityReturnOrderListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self, organization_id: int):
        return _return_order_queryset(organization_id)

    def get(self, request: Request) -> Response:
        membership = get_compat_membership(request)
        if membership is None:
            return empty_compat_response(request=request, view=self)

        warehouse_id = get_optional_int(request, "warehouse", "warehouse_id")
        customer_account_id = get_optional_int(request, "customer", "customer_account", "customer_account_id")
        order_type = request.query_params.get("order_type")
        status_value = request.query_params.get("status")
        status_values = get_query_values(request, "status__in")
        return_number_filter = str(request.query_params.get("return_number__icontains") or "").strip()
        search = str(request.query_params.get("search") or "").strip()

        queryset = self.get_queryset(membership.organization_id)
        if warehouse_id is not None:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        if customer_account_id is not None:
            queryset = queryset.filter(customer_account_id=customer_account_id)
        if isinstance(order_type, str) and order_type.strip():
            queryset = queryset.filter(order_type=order_type.strip().upper())
        if isinstance(status_value, str) and status_value.strip():
            queryset = queryset.filter(status=status_value.strip().upper())
        if status_values:
            queryset = queryset.filter(status__in=[value.upper() for value in status_values])
        if return_number_filter:
            queryset = queryset.filter(return_number__icontains=return_number_filter)
        if search:
            queryset = queryset.filter(
                Q(return_number__icontains=search)
                | Q(customer_name__icontains=search)
                | Q(customer_code__icontains=search)
                | Q(sales_order__order_number__icontains=search)
            )

        return paginate_compat_list(
            request=request,
            view=self,
            records=queryset,
            serializer=_serialize_return_order,
        )


class CompatibilityReturnOrderDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, return_order_id: int) -> Response:
        membership = get_compat_membership(request)
        if membership is None:
            return Response(status=404)

        return_order = get_object_or_404(
            _return_order_queryset(membership.organization_id),
            pk=return_order_id,
        )
        return Response(_serialize_return_order(return_order))
