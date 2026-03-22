from django.urls import path

from .views import OrganizationUserCreateAPIView

urlpatterns = [
    path(
        "organizations/<int:organization_id>/users/",
        OrganizationUserCreateAPIView.as_view(),
        name="organization-user-create",
    ),
]
