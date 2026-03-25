from __future__ import annotations

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization
from apps.reporting.models import OperationalReportExport, WarehouseKpiSnapshot
from apps.reporting.permissions import CanManageReporting, CanViewReporting
from apps.reporting.serializers import OperationalReportExportSerializer, WarehouseKpiSnapshotSerializer
from apps.reporting.services.reporting_service import (
    KpiSnapshotInput,
    OperationalReportInput,
    generate_operational_report,
    generate_warehouse_kpi_snapshot,
    list_kpi_snapshots,
    list_operational_report_exports,
)
from apps.warehouse.models import Warehouse


def _actor_name_from_request(request: Request) -> str:
    email = getattr(request.user, "email", "")
    if isinstance(email, str) and email.strip():
        return email.strip()
    return "system"


class OrganizationReportingBaseAPIView(APIView):
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)

    def get_warehouse(self, warehouse_id: int) -> Warehouse:
        return get_object_or_404(Warehouse, pk=warehouse_id, organization=self.organization)


class WarehouseKpiSnapshotListCreateAPIView(OrganizationReportingBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewReporting()]
        return [CanManageReporting()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        snapshot_date = request.query_params.get("snapshot_date")
        snapshots = list_kpi_snapshots(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            snapshot_date=snapshot_date or None,
        )
        return Response(WarehouseKpiSnapshotSerializer(snapshots, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = WarehouseKpiSnapshotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        snapshot = generate_warehouse_kpi_snapshot(
            payload=KpiSnapshotInput(
                organization=self.organization,
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                snapshot_date=serializer.validated_data["snapshot_date"],
            ),
            operator_name=_actor_name_from_request(request),
        )
        return Response(WarehouseKpiSnapshotSerializer(snapshot).data, status=status.HTTP_201_CREATED)


class WarehouseKpiSnapshotDetailAPIView(OrganizationReportingBaseAPIView):
    permission_classes = [CanViewReporting]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        snapshot = get_object_or_404(
            WarehouseKpiSnapshot,
            pk=kwargs["kpi_snapshot_id"],
            organization=self.organization,
        )
        return Response(WarehouseKpiSnapshotSerializer(snapshot).data)


class OperationalReportExportListCreateAPIView(OrganizationReportingBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewReporting()]
        return [CanManageReporting()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        report_type = request.query_params.get("report_type")
        exports = list_operational_report_exports(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            report_type=report_type or None,
        )
        return Response(OperationalReportExportSerializer(exports, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = OperationalReportExportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        warehouse = None
        if serializer.validated_data.get("warehouse_id") is not None:
            warehouse = self.get_warehouse(serializer.validated_data["warehouse_id"])
        export = generate_operational_report(
            payload=OperationalReportInput(
                organization=self.organization,
                warehouse=warehouse,
                report_type=serializer.validated_data["report_type"],
                date_from=serializer.validated_data.get("date_from"),
                date_to=serializer.validated_data.get("date_to"),
                parameters=serializer.validated_data.get("parameters", {}),
            ),
            operator_name=_actor_name_from_request(request),
        )
        return Response(OperationalReportExportSerializer(export).data, status=status.HTTP_201_CREATED)


class OperationalReportExportDetailAPIView(OrganizationReportingBaseAPIView):
    permission_classes = [CanViewReporting]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        export = get_object_or_404(
            OperationalReportExport,
            pk=kwargs["report_export_id"],
            organization=self.organization,
        )
        return Response(OperationalReportExportSerializer(export).data)


class OperationalReportExportDownloadAPIView(OrganizationReportingBaseAPIView):
    permission_classes = [CanViewReporting]

    def get(self, request: Request, *args: object, **kwargs: object) -> HttpResponse:
        export = get_object_or_404(
            OperationalReportExport,
            pk=kwargs["report_export_id"],
            organization=self.organization,
        )
        response = HttpResponse(export.content, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{export.file_name}"'
        return response

