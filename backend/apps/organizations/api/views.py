from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.organizations.models import Organization
from apps.organizations.permissions import CanManageOrganizationUsers
from apps.organizations.serializers import OrganizationUserCreateSerializer
from apps.organizations.services.membership_service import (
    CreateOrganizationUserInput,
    MembershipError,
    create_organization_user,
)


class OrganizationUserCreateAPIView(APIView):
    permission_classes = [CanManageOrganizationUsers]
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = OrganizationUserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            membership, user_created = create_organization_user(
                CreateOrganizationUserInput(
                    actor=request.user,
                    organization=self.organization,
                    **serializer.validated_data,
                )
            )
        except MembershipError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)

        return Response(
            {
                "user_id": membership.user.id,
                "email": membership.user.email,
                "membership_type": membership.membership_type,
                "organization_id": membership.organization.id,
                "role_codes": list(
                    membership.role_assignments.values_list("role__code", flat=True)
                ),
                "customer_account_ids": list(
                    membership.client_account_accesses.values_list("customer_account_id", flat=True)
                ),
                "user_created": user_created,
            },
            status=status.HTTP_201_CREATED,
        )
