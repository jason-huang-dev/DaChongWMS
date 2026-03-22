from django.urls import path

from .views import OrganizationCustomerAccountDetailAPIView, OrganizationCustomerAccountListCreateAPIView

urlpatterns = [
    path(
        "organizations/<int:organization_id>/customer-accounts/",
        OrganizationCustomerAccountListCreateAPIView.as_view(),
        name="organization-customer-account-list",
    ),
    path(
        "organizations/<int:organization_id>/customer-accounts/<int:customer_account_id>/",
        OrganizationCustomerAccountDetailAPIView.as_view(),
        name="organization-customer-account-detail",
    ),
]
