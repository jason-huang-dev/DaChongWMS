from __future__ import annotations

from datetime import datetime
from typing import Any

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.permissions import IsActiveAuthenticated
from apps.accounts.services.session_service import (
    authenticate_user_identifier,
    build_authenticated_response,
    ensure_operator_profile,
    get_default_membership_for_user,
    get_authenticated_membership,
    get_membership_display_role,
    provision_test_system_session,
    provision_signup_session,
    reconcile_authenticated_membership,
)
from apps.accounts.throttles import LegacyLoginRateThrottle, LegacySignupRateThrottle
from apps.iam.permissions import membership_permission_codes
from apps.iam.models import Role
from apps.iam.role_assignment_policy import can_assign_role, sync_role_assignment_policies
from apps.organizations.api.compat_serializers import CompatibilityStaffSerializer
from apps.organizations.models import OrganizationStaffProfile
from apps.organizations.services.access_admin_service import (
    StaffDirectoryInput,
    create_staff_directory_entry,
    update_staff_directory_entry,
)

from .compat_serializers import LegacyLoginSerializer, LegacySignupSerializer

COMPATIBLE_DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"


class CompatibilityPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500


def _legacy_success_response(*, data: Any, response_status: int = status.HTTP_200_OK) -> Response:
    return Response(
        {
            "code": "200",
            "msg": "Success Create",
            "data": data,
        },
        status=response_status,
    )


def _legacy_error_response(
    *,
    message: str,
    response_status: int,
    code: str = "1012",
    data: Any = None,
) -> Response:
    return Response(
        {
            "code": code,
            "msg": message,
            "data": data,
        },
        status=response_status,
    )


def _format_datetime(value: datetime | None) -> str:
    if value is None:
        return ""
    return timezone.localtime(value).strftime(COMPATIBLE_DATETIME_FORMAT)


def _serialize_staff_record(*, membership_id: int, user: User, role_name: str) -> dict[str, object]:
    return {
        "id": user.id,
        "staff_name": user.display_name,
        "staff_type": role_name,
        "check_code": 0,
        "create_time": _format_datetime(user.date_joined),
        "update_time": _format_datetime(user.last_login or user.date_joined),
        "error_check_code_counter": 0,
        "is_lock": False,
        "membership_id": membership_id,
    }


def _serialize_staff_profile(profile: OrganizationStaffProfile) -> dict[str, object]:
    if profile.membership_id is not None:
        reconcile_authenticated_membership(profile.membership)
    return {
        "id": profile.id,
        "staff_name": profile.staff_name,
        "staff_type": profile.staff_type,
        "check_code": profile.check_code,
        "create_time": _format_datetime(profile.create_time),
        "update_time": _format_datetime(profile.update_time),
        "error_check_code_counter": profile.error_check_code_counter,
        "is_lock": profile.is_lock,
        "permission_codes": list(membership_permission_codes(profile.membership)),
    }


def _serialize_staff_type(role: Role, *, position: int) -> dict[str, object]:
    timestamp = _format_datetime(timezone.now())
    return {
        "id": position,
        "staff_type": role.name,
        "creator": "system",
        "create_time": timestamp,
        "update_time": timestamp,
    }


class LegacyLoginAPIView(APIView):
    authentication_classes: list[type[object]] = []
    permission_classes = [AllowAny]
    throttle_classes = [LegacyLoginRateThrottle]

    def post(self, request: Request) -> Response:
        serializer = LegacyLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return _legacy_error_response(
                message="Email and password are required",
                response_status=status.HTTP_400_BAD_REQUEST,
                code="1011",
                data={"name": request.data.get("name", "")},
            )

        identifier = serializer.validated_data["name"]
        password = serializer.validated_data["password"]
        user = authenticate_user_identifier(identifier=identifier, password=password)
        if user is None:
            return _legacy_error_response(
                message="User Name Or Password Error",
                response_status=status.HTTP_401_UNAUTHORIZED,
                code="1011",
                data={"name": identifier},
            )

        membership = get_default_membership_for_user(user)
        if membership is None:
            return _legacy_error_response(
                message="No active organization membership exists for this user.",
                response_status=status.HTTP_400_BAD_REQUEST,
                code="1012",
            )

        return _legacy_success_response(data=build_authenticated_response(membership=membership))


class LegacySignupAPIView(APIView):
    authentication_classes: list[type[object]] = []
    permission_classes = [AllowAny]
    throttle_classes = [LegacySignupRateThrottle]

    def post(self, request: Request) -> Response:
        serializer = LegacySignupSerializer(data=request.data)
        if not serializer.is_valid():
            return _legacy_error_response(
                message=" ".join(
                    str(message)
                    for messages in serializer.errors.values()
                    for message in messages
                ),
                response_status=status.HTTP_400_BAD_REQUEST,
                code="1012",
            )

        email = serializer.validated_data["email"]
        if User.objects.filter(email__iexact=email).exists():
            return _legacy_error_response(
                message="Unable to create an account with the provided information.",
                response_status=status.HTTP_400_BAD_REQUEST,
                code="1016",
            )

        signup_session = provision_signup_session(
            full_name=serializer.validated_data["name"],
            email=email,
            password=serializer.validated_data["password1"],
        )
        return _legacy_success_response(
            data=build_authenticated_response(
                membership=signup_session.membership,
                token=signup_session.token,
                extra={"email": email},
            ),
            response_status=status.HTTP_201_CREATED,
        )


class TestSystemBootstrapAPIView(APIView):
    authentication_classes: list[type[object]] = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        if not bool(getattr(settings, "TEST_SYSTEM_ENABLED", False)):
            return _legacy_error_response(
                message="Test-system bootstrap is disabled.",
                response_status=status.HTTP_403_FORBIDDEN,
                code="1013",
            )

        bootstrap_session = provision_test_system_session()
        created_anything = any(count > 0 for count in bootstrap_session.seed_summary.values())
        return _legacy_success_response(
            data=build_authenticated_response(
                membership=bootstrap_session.session.membership,
                token=bootstrap_session.session.token,
                extra={
                    "used_default_name": bootstrap_session.used_default_name,
                    "used_default_password": bootstrap_session.used_default_password,
                    "seed_summary": bootstrap_session.seed_summary,
                },
            ),
            response_status=status.HTTP_201_CREATED if created_anything else status.HTTP_200_OK,
        )


class CompatibilityStaffDetailAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request, staff_id: int) -> Response:
        membership = get_authenticated_membership(user=request.user, auth=request.auth)
        if membership is None:
            return Response({"detail": "Staff record not found."}, status=status.HTTP_404_NOT_FOUND)

        profile = (
            OrganizationStaffProfile.objects.filter(
                id=staff_id,
                organization_id=membership.organization_id,
            )
            .select_related("membership", "membership__user")
            .first()
        )
        if profile is None:
            return Response({"detail": "Staff record not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_staff_profile(profile))

    def patch(self, request: Request, staff_id: int) -> Response:
        membership = get_authenticated_membership(user=request.user, auth=request.auth)
        if membership is None:
            return Response({"detail": "Staff record not found."}, status=status.HTTP_404_NOT_FOUND)
        profile = (
            OrganizationStaffProfile.objects.filter(
                id=staff_id,
                organization_id=membership.organization_id,
            )
            .select_related("membership")
            .first()
        )
        if profile is None:
            return Response({"detail": "Staff record not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CompatibilityStaffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = update_staff_directory_entry(
            actor_membership=membership,
            entry=profile,
            payload=StaffDirectoryInput(
                organization=membership.organization,
                actor_membership=membership,
                **serializer.validated_data,
            ),
        )
        return Response(_serialize_staff_profile(updated))


class CompatibilityStaffListAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request) -> Response:
        membership = get_authenticated_membership(user=request.user, auth=request.auth)
        if membership is None:
            return Response({"count": 0, "next": None, "previous": None, "results": []})

        queryset = OrganizationStaffProfile.objects.filter(
            organization_id=membership.organization_id,
            membership__isnull=True,
        ).order_by("staff_name", "id")
        staff_name_filter = str(request.query_params.get("staff_name__icontains") or "").strip()
        if staff_name_filter:
            queryset = queryset.filter(staff_name__icontains=staff_name_filter)
        staff_type_filter = str(request.query_params.get("staff_type") or "").strip()
        if staff_type_filter:
            queryset = queryset.filter(staff_type__iexact=staff_type_filter)

        paginator = CompatibilityPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        rows = [_serialize_staff_profile(profile) for profile in (page or queryset)]
        if page is not None:
            return paginator.get_paginated_response(rows)
        return Response(rows)

    def post(self, request: Request) -> Response:
        membership = get_authenticated_membership(user=request.user, auth=request.auth)
        if membership is None:
            return Response({"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = CompatibilityStaffSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = create_staff_directory_entry(
            StaffDirectoryInput(
                organization=membership.organization,
                actor_membership=membership,
                **serializer.validated_data,
            )
        )
        return Response(_serialize_staff_profile(entry), status=status.HTTP_201_CREATED)


class CompatibilityStaffTypeListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        sync_role_assignment_policies()
        roles = list(
            Role.objects.filter(organization__isnull=True, is_system=True, is_active=True)
            .order_by("name", "id")
        )
        membership = get_authenticated_membership(user=request.user, auth=request.auth)
        if membership is not None:
            roles = [role for role in roles if can_assign_role(membership, role)]
        paginator = CompatibilityPagination()
        page = paginator.paginate_queryset(roles, request, view=self)
        serialized_roles = [
            _serialize_staff_type(role, position=index + 1)
            for index, role in enumerate(page or roles)
        ]
        if page is not None:
            return paginator.get_paginated_response(serialized_roles)
        return Response(serialized_roles)


class CompatibilityMfaStatusAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response(
            {
                "has_verified_enrollment": False,
                "enrollment_required": False,
                "primary_enrollment": None,
                "recovery_codes_remaining": 0,
                "verified_methods": [],
            }
        )
