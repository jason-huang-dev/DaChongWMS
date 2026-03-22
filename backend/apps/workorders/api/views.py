from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization
from apps.partners.models import CustomerAccount
from apps.warehouse.models import Warehouse
from apps.workorders.models import WorkOrder, WorkOrderType
from apps.workorders.permissions import (
    CanManageWorkOrders,
    CanManageWorkOrderTypes,
    CanViewWorkOrders,
)
from apps.workorders.serializers import WorkOrderSerializer, WorkOrderTypeSerializer
from apps.workorders.services.work_order_service import (
    CreateWorkOrderInput,
    CreateWorkOrderTypeInput,
    UNSET,
    create_work_order,
    create_work_order_type,
    list_organization_work_orders,
    list_organization_work_order_types,
    update_work_order,
    update_work_order_type,
)


class OrganizationWorkOrderBaseAPIView(APIView):
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)

    def _get_optional_warehouse(self, warehouse_id: int | None) -> Warehouse | None:
        if warehouse_id is None:
            return None
        return get_object_or_404(
            Warehouse,
            pk=warehouse_id,
            organization=self.organization,
        )

    def _get_optional_customer_account(self, customer_account_id: int | None) -> CustomerAccount | None:
        if customer_account_id is None:
            return None
        return get_object_or_404(
            CustomerAccount,
            pk=customer_account_id,
            organization=self.organization,
        )


class OrganizationWorkOrderTypeListCreateAPIView(OrganizationWorkOrderBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewWorkOrders()]
        return [CanManageWorkOrderTypes()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        work_order_types = list_organization_work_order_types(organization=self.organization)
        return Response(WorkOrderTypeSerializer(work_order_types, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = WorkOrderTypeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        work_order_type = create_work_order_type(
            CreateWorkOrderTypeInput(
                organization=self.organization,
                **serializer.validated_data,
            )
        )
        return Response(WorkOrderTypeSerializer(work_order_type).data, status=status.HTTP_201_CREATED)


class OrganizationWorkOrderTypeDetailAPIView(OrganizationWorkOrderBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewWorkOrders()]
        return [CanManageWorkOrderTypes()]

    def get_object(self, work_order_type_id: int) -> WorkOrderType:
        return get_object_or_404(
            WorkOrderType,
            pk=work_order_type_id,
            organization=self.organization,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        work_order_type = self.get_object(kwargs["work_order_type_id"])
        return Response(WorkOrderTypeSerializer(work_order_type).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        work_order_type = self.get_object(kwargs["work_order_type_id"])
        serializer = WorkOrderTypeSerializer(work_order_type, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_work_order_type(work_order_type, **serializer.validated_data)
        return Response(WorkOrderTypeSerializer(updated).data)


class OrganizationWorkOrderListCreateAPIView(OrganizationWorkOrderBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewWorkOrders()]
        return [CanManageWorkOrders()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        raw_warehouse_id = request.query_params.get("warehouse_id")
        warehouse = self._get_optional_warehouse(int(raw_warehouse_id)) if raw_warehouse_id else None
        work_orders = list_organization_work_orders(
            organization=self.organization,
            warehouse=warehouse,
        )
        return Response(WorkOrderSerializer(work_orders, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = WorkOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        work_order_type = get_object_or_404(
            WorkOrderType,
            pk=serializer.validated_data["work_order_type_id"],
            organization=self.organization,
        )
        work_order = create_work_order(
            CreateWorkOrderInput(
                organization=self.organization,
                work_order_type=work_order_type,
                warehouse=self._get_optional_warehouse(serializer.validated_data.get("warehouse_id")),
                customer_account=self._get_optional_customer_account(
                    serializer.validated_data.get("customer_account_id")
                ),
                title=serializer.validated_data["title"],
                source_reference=serializer.validated_data.get("source_reference", ""),
                status=serializer.validated_data.get("status", WorkOrder.Status.PENDING_REVIEW),
                urgency=serializer.validated_data.get("urgency"),
                priority_score=serializer.validated_data.get("priority_score"),
                assignee_name=serializer.validated_data.get("assignee_name", ""),
                scheduled_start_at=serializer.validated_data.get("scheduled_start_at"),
                due_at=serializer.validated_data.get("due_at"),
                started_at=serializer.validated_data.get("started_at"),
                completed_at=serializer.validated_data.get("completed_at"),
                estimated_duration_minutes=serializer.validated_data.get("estimated_duration_minutes", 0),
                notes=serializer.validated_data.get("notes", ""),
            )
        )
        return Response(WorkOrderSerializer(work_order).data, status=status.HTTP_201_CREATED)


class OrganizationWorkOrderDetailAPIView(OrganizationWorkOrderBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewWorkOrders()]
        return [CanManageWorkOrders()]

    def get_object(self, work_order_id: int) -> WorkOrder:
        return get_object_or_404(
            WorkOrder.objects.select_related("work_order_type", "warehouse", "customer_account"),
            pk=work_order_id,
            organization=self.organization,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        work_order = self.get_object(kwargs["work_order_id"])
        return Response(WorkOrderSerializer(work_order).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        work_order = self.get_object(kwargs["work_order_id"])
        serializer = WorkOrderSerializer(work_order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        work_order_type_id = serializer.validated_data.get("work_order_type_id")
        work_order_type = work_order.work_order_type
        if work_order_type_id is not None:
            work_order_type = get_object_or_404(
                WorkOrderType,
                pk=work_order_type_id,
                organization=self.organization,
            )

        updated = update_work_order(
            work_order,
            work_order_type=work_order_type,
            warehouse=(
                self._get_optional_warehouse(serializer.validated_data.get("warehouse_id"))
                if "warehouse_id" in serializer.validated_data
                else UNSET
            ),
            customer_account=(
                self._get_optional_customer_account(serializer.validated_data.get("customer_account_id"))
                if "customer_account_id" in serializer.validated_data
                else UNSET
            ),
            title=serializer.validated_data.get("title"),
            source_reference=serializer.validated_data.get("source_reference"),
            status=serializer.validated_data.get("status"),
            urgency=serializer.validated_data.get("urgency"),
            priority_score=serializer.validated_data.get("priority_score"),
            assignee_name=serializer.validated_data.get("assignee_name"),
            scheduled_start_at=serializer.validated_data.get("scheduled_start_at", UNSET),
            due_at=serializer.validated_data.get("due_at", UNSET),
            started_at=serializer.validated_data.get("started_at", UNSET),
            completed_at=serializer.validated_data.get("completed_at", UNSET),
            estimated_duration_minutes=serializer.validated_data.get("estimated_duration_minutes"),
            notes=serializer.validated_data.get("notes"),
        )
        return Response(WorkOrderSerializer(updated).data)
