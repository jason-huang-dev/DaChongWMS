from django.urls import path

from apps.reporting.api.views import (
    OperationalReportExportDetailAPIView,
    OperationalReportExportDownloadAPIView,
    OperationalReportExportListCreateAPIView,
    WarehouseKpiSnapshotDetailAPIView,
    WarehouseKpiSnapshotListCreateAPIView,
)


urlpatterns = [
    path(
        "organizations/<int:organization_id>/reporting/kpi-snapshots/",
        WarehouseKpiSnapshotListCreateAPIView.as_view(),
        name="organization-reporting-kpi-snapshot-list",
    ),
    path(
        "organizations/<int:organization_id>/reporting/kpi-snapshots/<int:kpi_snapshot_id>/",
        WarehouseKpiSnapshotDetailAPIView.as_view(),
        name="organization-reporting-kpi-snapshot-detail",
    ),
    path(
        "organizations/<int:organization_id>/reporting/report-exports/",
        OperationalReportExportListCreateAPIView.as_view(),
        name="organization-report-export-list",
    ),
    path(
        "organizations/<int:organization_id>/reporting/report-exports/<int:report_export_id>/",
        OperationalReportExportDetailAPIView.as_view(),
        name="organization-report-export-detail",
    ),
    path(
        "organizations/<int:organization_id>/reporting/report-exports/<int:report_export_id>/download/",
        OperationalReportExportDownloadAPIView.as_view(),
        name="organization-report-export-download",
    ),
]

