from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def root_status(_request):
    return JsonResponse(
        {
            "status": "ok",
            "service": "dachongwms-backend",
            "health": "/health/",
            "api": "/api/v1/",
        }
    )


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("", root_status, name="root-status"),
    path("admin/", admin.site.urls),
    path("accounts/", include("allauth.urls")),
    path("health/", healthcheck, name="healthcheck"),
    path("api-auth/", include("rest_framework.urls")),
    path("api/", include("apps.accounts.api.compat_urls")),
    path("api/", include("apps.organizations.api.compat_urls")),
    path("api/", include("apps.warehouse.api.compat_urls")),
    path("api/", include("apps.locations.api.compat_urls")),
    path("api/", include("apps.inventory.api.compat_urls")),
    path("api/", include("apps.inbound.api.compat_urls")),
    path("api/", include("apps.outbound.api.compat_urls")),
    path("api/", include("apps.returns.api.compat_urls")),
    path("api/", include("apps.counting.api.compat_urls")),
    path("api/v1/auth/", include("apps.accounts.api.urls")),
    path("api/v1/", include("apps.organizations.api.urls")),
    path("api/v1/", include("apps.products.api.urls")),
    path("api/v1/", include("apps.partners.api.urls")),
    path("api/v1/", include("apps.logistics.api.urls")),
    path("api/v1/", include("apps.fees.api.urls")),
    path("api/v1/", include("apps.workorders.api.urls")),
    path("api/v1/", include("apps.warehouse.api.urls")),
    path("api/v1/", include("apps.locations.api.urls")),
    path("api/v1/", include("apps.inventory.api.urls")),
    path("api/v1/", include("apps.transfers.api.urls")),
    path("api/v1/", include("apps.counting.api.urls")),
    path("api/v1/", include("apps.inbound.api.urls")),
    path("api/v1/", include("apps.outbound.api.urls")),
    path("api/v1/", include("apps.returns.api.urls")),
    path("api/v1/", include("apps.reporting.api.urls")),
]
