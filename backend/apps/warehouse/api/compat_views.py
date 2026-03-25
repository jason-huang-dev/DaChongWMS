from __future__ import annotations

from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.services.session_service import get_authenticated_membership
from apps.warehouse.models import Warehouse


class CompatibilityPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500


def _serialize_warehouse_record(warehouse: Warehouse) -> dict[str, object]:
    return {
        "id": warehouse.id,
        "warehouse_name": warehouse.name,
        "warehouse_city": "",
        "warehouse_address": "",
        "warehouse_contact": "",
        "warehouse_manager": "",
        "creator": "",
        "create_time": "",
        "update_time": "",
    }


class CompatibilityWarehouseListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        membership = get_authenticated_membership(user=request.user, auth=request.auth)
        if membership is None:
            return Response({"count": 0, "next": None, "previous": None, "results": []})

        warehouses = list(
            Warehouse.objects.filter(
                organization_id=membership.organization_id,
                is_active=True,
            ).order_by("name", "id")
        )
        paginator = CompatibilityPagination()
        page = paginator.paginate_queryset(warehouses, request, view=self)
        warehouse_rows = [_serialize_warehouse_record(warehouse) for warehouse in (page or warehouses)]
        if page is not None:
            return paginator.get_paginated_response(warehouse_rows)
        return Response(warehouse_rows)
