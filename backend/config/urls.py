from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def healthcheck(_request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", healthcheck, name="healthcheck"),
    path("api-auth/", include("rest_framework.urls")),
    path("api/v1/auth/", include("apps.accounts.api.urls")),
    path("api/v1/", include("apps.organizations.api.urls")),
    path("api/v1/", include("apps.products.api.urls")),
    path("api/v1/", include("apps.partners.api.urls")),
    path("api/v1/", include("apps.logistics.api.urls")),
    path("api/v1/", include("apps.fees.api.urls")),
    path("api/v1/", include("apps.workorders.api.urls")),
    path("api/v1/", include("apps.warehouse.api.urls")),
]
