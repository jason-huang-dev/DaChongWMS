from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.api_compat import (
    decimal_to_string,
    empty_compat_response,
    get_compat_membership,
    get_optional_int,
    iso_datetime,
    paginate_compat_list,
)
from apps.inventory.models import InventoryBalance


def _serialize_inventory_balance(balance: InventoryBalance) -> dict[str, object]:
    return {
        "id": balance.id,
        "warehouse": balance.warehouse_id,
        "warehouse_name": balance.warehouse.name,
        "location": balance.location_id,
        "location_code": balance.location.code,
        "goods": balance.product_id,
        "goods_code": balance.product.sku,
        "stock_status": balance.stock_status,
        "lot_number": balance.lot_number,
        "serial_number": balance.serial_number,
        "on_hand_qty": decimal_to_string(balance.on_hand_qty),
        "allocated_qty": decimal_to_string(balance.allocated_qty),
        "hold_qty": decimal_to_string(balance.hold_qty),
        "available_qty": decimal_to_string(balance.available_qty),
        "unit_cost": decimal_to_string(balance.unit_cost),
        "currency": balance.currency,
        "creator": "",
        "last_movement_at": iso_datetime(balance.last_movement_at),
        "create_time": "",
        "update_time": "",
    }


class CompatibilityInventoryBalanceListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        membership = get_compat_membership(request)
        if membership is None:
            return empty_compat_response(request=request, view=self)

        warehouse_id = get_optional_int(request, "warehouse", "warehouse_id")
        location_id = get_optional_int(request, "location", "location_id")
        product_id = get_optional_int(request, "goods", "goods_id", "product_id")
        stock_status = request.query_params.get("stock_status")

        queryset = (
            InventoryBalance.objects.select_related("warehouse", "location", "product")
            .filter(
                organization_id=membership.organization_id,
                warehouse__is_active=True,
                location__is_active=True,
                product__is_active=True,
            )
            .order_by("warehouse__name", "location__code", "product__sku", "id")
        )
        if warehouse_id is not None:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        if location_id is not None:
            queryset = queryset.filter(location_id=location_id)
        if product_id is not None:
            queryset = queryset.filter(product_id=product_id)
        if isinstance(stock_status, str) and stock_status.strip():
            queryset = queryset.filter(stock_status=stock_status.strip().upper())

        return paginate_compat_list(
            request=request,
            view=self,
            records=queryset,
            serializer=_serialize_inventory_balance,
        )
