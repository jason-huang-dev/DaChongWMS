from django.urls import path

from .compat_views import CompatibilityLocationListAPIView

urlpatterns = [
    path("locations/", CompatibilityLocationListAPIView.as_view(), name="compat-location-list"),
]
