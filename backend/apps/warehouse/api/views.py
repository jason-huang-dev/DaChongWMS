from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization
from apps.warehouse.models import Warehouse
from apps.warehouse.permissions import CanManageWarehouse, CanViewWarehouse
from apps.warehouse.serializers import WarehouseSerializer
from apps.warehouse.services.warehouse_service import (
    CreateWarehouseInput,
    create_warehouse,
    list_organization_warehouses,
    update_warehouse,
)


class OrganizationWarehouseBaseAPIView(APIView):
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)


class OrganizationWarehouseListCreateAPIView(OrganizationWarehouseBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewWarehouse()]
        return [CanManageWarehouse()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouses = list_organization_warehouses(organization=self.organization)
        serializer = WarehouseSerializer(warehouses, many=True)
        return Response(serializer.data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = WarehouseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        warehouse = create_warehouse(
            CreateWarehouseInput(
                organization=self.organization,
                **serializer.validated_data,
            )
        )
        return Response(WarehouseSerializer(warehouse).data, status=status.HTTP_201_CREATED)


class OrganizationWarehouseDetailAPIView(OrganizationWarehouseBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewWarehouse()]
        return [CanManageWarehouse()]

    def get_object(self, warehouse_id: int) -> Warehouse:
        return get_object_or_404(
            Warehouse,
            pk=warehouse_id,
            organization=self.organization,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse = self.get_object(kwargs["warehouse_id"])
        return Response(WarehouseSerializer(warehouse).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse = self.get_object(kwargs["warehouse_id"])
        serializer = WarehouseSerializer(warehouse, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_warehouse(warehouse, **serializer.validated_data)
        return Response(WarehouseSerializer(updated).data)
