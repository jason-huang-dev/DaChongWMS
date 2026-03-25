from django.urls import path

from .views import (
    LocationLockDetailAPIView,
    LocationLockListCreateAPIView,
    LocationDetailAPIView,
    LocationListCreateAPIView,
    LocationTypeDetailAPIView,
    LocationTypeListCreateAPIView,
    ZoneDetailAPIView,
    ZoneListCreateAPIView,
)

urlpatterns = [
    path(
        "organizations/<int:organization_id>/zones/",
        ZoneListCreateAPIView.as_view(),
        name="organization-zone-list",
    ),
    path(
        "organizations/<int:organization_id>/zones/<int:zone_id>/",
        ZoneDetailAPIView.as_view(),
        name="organization-zone-detail",
    ),
    path(
        "organizations/<int:organization_id>/location-types/",
        LocationTypeListCreateAPIView.as_view(),
        name="organization-location-type-list",
    ),
    path(
        "organizations/<int:organization_id>/location-types/<int:location_type_id>/",
        LocationTypeDetailAPIView.as_view(),
        name="organization-location-type-detail",
    ),
    path(
        "organizations/<int:organization_id>/locations/",
        LocationListCreateAPIView.as_view(),
        name="organization-location-list",
    ),
    path(
        "organizations/<int:organization_id>/locations/<int:location_id>/",
        LocationDetailAPIView.as_view(),
        name="organization-location-detail",
    ),
    path(
        "organizations/<int:organization_id>/location-locks/",
        LocationLockListCreateAPIView.as_view(),
        name="organization-location-lock-list",
    ),
    path(
        "organizations/<int:organization_id>/location-locks/<int:location_lock_id>/",
        LocationLockDetailAPIView.as_view(),
        name="organization-location-lock-detail",
    ),
]

