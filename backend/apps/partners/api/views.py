from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.iam.constants import PermissionCode
from apps.iam.permissions import get_active_membership
from apps.iam.permissions import user_has_organization_permission
from apps.organizations.models import Organization
from apps.partners.models import CustomerAccount
from apps.partners.permissions import (
    CanManageCustomerAccounts,
    CanViewCustomerAccountDetail,
    CanViewCustomerAccounts,
)
from apps.partners.serializers import CustomerAccountSerializer
from apps.partners.services.customer_accounts import (
    CreateCustomerAccountInput,
    create_customer_account,
    list_visible_customer_accounts,
    update_customer_account,
)


class OrganizationCustomerAccountBaseAPIView(APIView):
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)


class OrganizationCustomerAccountListCreateAPIView(OrganizationCustomerAccountBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewCustomerAccounts()]
        return [CanManageCustomerAccounts()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        membership = get_active_membership(request.user, self.organization)
        if membership is None and not getattr(request.user, "is_superuser", False):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if getattr(request.user, "is_superuser", False) or user_has_organization_permission(
            request.user,
            self.organization,
            PermissionCode.MANAGE_CUSTOMER_ACCOUNTS,
        ):
            accounts = list(
                CustomerAccount.objects.filter(
                    organization=self.organization,
                ).order_by("name", "id")
            )
        else:
            accounts = list_visible_customer_accounts(membership)
        return Response(CustomerAccountSerializer(accounts, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = CustomerAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = create_customer_account(
            CreateCustomerAccountInput(
                organization=self.organization,
                **serializer.validated_data,
            )
        )
        return Response(CustomerAccountSerializer(account).data, status=status.HTTP_201_CREATED)


class OrganizationCustomerAccountDetailAPIView(OrganizationCustomerAccountBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewCustomerAccounts(), CanViewCustomerAccountDetail()]
        return [CanManageCustomerAccounts()]

    def get_object(self, customer_account_id: int) -> CustomerAccount:
        return get_object_or_404(
            CustomerAccount,
            pk=customer_account_id,
            organization=self.organization,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        account = self.get_object(kwargs["customer_account_id"])
        self.check_object_permissions(request, account)
        return Response(CustomerAccountSerializer(account).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        account = self.get_object(kwargs["customer_account_id"])
        serializer = CustomerAccountSerializer(account, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_customer_account(account, **serializer.validated_data)
        return Response(CustomerAccountSerializer(updated).data)
