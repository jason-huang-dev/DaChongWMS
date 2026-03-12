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


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="api-schema"),
        name="api-docs",
    ),
    path("api/warehouse/", include("warehouse.urls")),
    # Placeholder for future API apps – keep includes near docs for visibility.
    path("api/", include("rest_framework.urls")),
]
