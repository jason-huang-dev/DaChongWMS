"""Project-level URL routing for the DaChongWMS backend.

Routes administrative URLs, API schema generation, interactive Swagger docs,
and a placeholder namespace for app-specific API endpoints.
"""

from django.contrib import admin
from django.urls import include, path

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)
from userlogin import views as auth_views


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="api-schema"),
        name="api-docs",
    ),
    path("api/warehouse/", include("warehouse.urls")),
    path("api/locations/", include("locations.urls")),
    path("api/inventory/", include("inventory.urls")),
    path("api/automation/", include("automation.urls")),
    path("api/integrations/", include("integrations.urls")),
    path("api/inbound/", include("operations.inbound.urls")),
    path("api/outbound/", include("operations.outbound.urls")),
    path("api/counting/", include("operations.counting.urls")),
    path("api/transfers/", include("operations.transfers.urls")),
    path("api/returns/", include("operations.returns.urls")),
    path("api/reporting/", include("reporting.urls")),
    path("api/scanner/", include("scanner.urls")),
    path("api/staff/", include("staff.urls")),
    path("api/access/", include("access.urls")),
    path("api/mfa/", include("mfa.urls")),
    path("api/login/", include("userlogin.urls")),
    path("api/signup/", auth_views.register, name="signup"),
    path("api/test-system/", include("test_system.urls")),
    path("api/upload/", include("uploadfile.urls")),
    # Placeholder for future API apps – keep includes near docs for visibility.
    path("api/", include("rest_framework.urls")),
]
