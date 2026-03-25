from __future__ import annotations

from datetime import datetime
from typing import Any

from django.db.models import Q, QuerySet
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsActiveAuthenticated
from apps.accounts.services.session_service import (
    build_authenticated_response,
    can_manage_users,
    get_active_memberships_for_user,
    get_authenticated_membership,
    get_membership_display_role,
    get_membership_staff_profile,
    is_company_admin_membership,
)
from apps.organizations.api.compat_serializers import (
    CompatibilityCompanyMembershipSerializer,
    CompatibilityInviteAcceptanceSerializer,
    CompatibilityInviteSerializer,
    CompatibilityPasswordResetCompletionSerializer,
    CompatibilityPasswordResetSerializer,
)
from apps.organizations.models import (
    OrganizationAccessAuditAction,
    OrganizationAccessAuditEvent,
    OrganizationInvite,
    OrganizationMembership,
    OrganizationPasswordReset,
    OrganizationStaffProfile,
)
from apps.organizations.services.access_admin_service import (
    InviteCreateInput,
    InviteAcceptanceInput,
    MembershipAdminInput,
    PasswordResetCompletionInput,
    PasswordResetCreateInput,
    accept_invite,
    complete_password_reset,
    create_company_membership,
    create_invite,
    issue_password_reset,
    resolve_invite_status,
    resolve_password_reset_status,
    revoke_invite,
    revoke_password_reset,
    update_company_membership,
)

COMPATIBLE_DATETIME_FORMAT = "%Y-%m-%d %H:%M:%S"


class CompatibilityPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500


def _format_datetime(value: datetime | None) -> str:
    if value is None:
        return ""
    return timezone.localtime(value).strftime(COMPATIBLE_DATETIME_FORMAT)


def _get_current_membership(request: Request) -> OrganizationMembership | None:
    return get_authenticated_membership(user=request.user, auth=request.auth)


def _serialize_staff_profile(profile: OrganizationStaffProfile) -> dict[str, object]:
    return {
        "id": profile.id,
        "staff_name": profile.staff_name,
        "staff_type": profile.staff_type,
        "check_code": profile.check_code,
        "is_lock": profile.is_lock,
        "error_check_code_counter": profile.error_check_code_counter,
        "create_time": _format_datetime(profile.create_time),
        "update_time": _format_datetime(profile.update_time),
    }


def _serialize_membership(
    membership: OrganizationMembership,
    *,
    current_membership_id: int | None,
) -> dict[str, object]:
    staff_profile = get_membership_staff_profile(membership)
    return {
        "id": membership.id,
        "company_id": membership.organization_id,
        "company_name": membership.organization.name,
        "company_code": membership.organization.slug.upper(),
        "company_openid": membership.organization.slug,
        "company_description": "",
        "staff_id": staff_profile.id if staff_profile is not None else membership.user_id,
        "staff_name": staff_profile.staff_name if staff_profile is not None else membership.user.display_name,
        "staff_type": staff_profile.staff_type if staff_profile is not None else get_membership_display_role(membership),
        "username": membership.user.username or membership.user.email,
        "email": membership.user.email,
        "profile_token": "",
        "check_code": staff_profile.check_code if staff_profile is not None else 8888,
        "is_lock": staff_profile.is_lock if staff_profile is not None else False,
        "default_warehouse": staff_profile.default_warehouse_id if staff_profile is not None else None,
        "default_warehouse_name": (
            staff_profile.default_warehouse.name if staff_profile is not None and staff_profile.default_warehouse_id else ""
        ),
        "is_company_admin": is_company_admin_membership(membership),
        "can_manage_users": can_manage_users(membership),
        "is_active": membership.is_active,
        "last_selected_at": None,
        "is_current": membership.id == current_membership_id,
        "invited_by": "",
        "create_time": _format_datetime(membership.user.date_joined),
        "update_time": _format_datetime(membership.user.last_login or membership.user.date_joined),
    }


def _serialize_invite(invite: OrganizationInvite) -> dict[str, object]:
    return {
        "id": invite.id,
        "company_id": invite.organization_id,
        "company_name": invite.organization.name,
        "email": invite.email,
        "staff_name": invite.staff_name,
        "staff_type": invite.staff_type,
        "check_code": invite.check_code,
        "default_warehouse": invite.default_warehouse_id,
        "default_warehouse_name": invite.default_warehouse.name if invite.default_warehouse_id else "",
        "is_company_admin": invite.is_company_admin,
        "can_manage_users": invite.can_manage_users,
        "status": resolve_invite_status(invite),
        "invite_token": invite.invite_token,
        "invite_message": invite.invite_message,
        "invited_by": invite.invited_by,
        "expires_at": _format_datetime(invite.expires_at),
        "accepted_at": _format_datetime(invite.accepted_at) or None,
        "revoked_at": _format_datetime(invite.revoked_at) or None,
        "accepted_membership_id": invite.accepted_membership_id,
        "accepted_username": invite.accepted_membership.user.username if invite.accepted_membership_id else "",
        "create_time": _format_datetime(invite.create_time),
        "update_time": _format_datetime(invite.update_time),
    }


def _serialize_password_reset(password_reset: OrganizationPasswordReset) -> dict[str, object]:
    staff_profile = get_membership_staff_profile(password_reset.membership)
    return {
        "id": password_reset.id,
        "company_id": password_reset.organization_id,
        "company_name": password_reset.organization.name,
        "membership_id": password_reset.membership_id,
        "username": password_reset.membership.user.username or password_reset.membership.user.email,
        "email": password_reset.membership.user.email,
        "staff_name": staff_profile.staff_name if staff_profile is not None else password_reset.membership.user.display_name,
        "staff_type": staff_profile.staff_type if staff_profile is not None else get_membership_display_role(password_reset.membership),
        "reset_token": password_reset.reset_token,
        "status": resolve_password_reset_status(password_reset),
        "issued_by": password_reset.issued_by,
        "expires_at": _format_datetime(password_reset.expires_at),
        "completed_at": _format_datetime(password_reset.completed_at) or None,
        "revoked_at": _format_datetime(password_reset.revoked_at) or None,
        "notes": password_reset.notes,
        "create_time": _format_datetime(password_reset.create_time),
        "update_time": _format_datetime(password_reset.update_time),
    }


def _serialize_audit_event(event: OrganizationAccessAuditEvent) -> dict[str, object]:
    membership = event.membership
    membership_user = membership.user if membership is not None else None
    return {
        "id": event.id,
        "company_id": event.organization_id,
        "company_name": event.organization.name,
        "membership_id": membership.id if membership is not None else None,
        "username": membership_user.username if membership_user is not None else "",
        "invite": event.invite_id,
        "invite_email": event.invite.email if event.invite_id else "",
        "password_reset": event.password_reset_id,
        "password_reset_username": (
            event.password_reset.membership.user.username if event.password_reset_id else ""
        ),
        "action_type": event.action_type,
        "actor_name": event.actor_name,
        "target_identifier": event.target_identifier,
        "payload": event.payload,
        "occurred_at": _format_datetime(event.occurred_at),
        "create_time": _format_datetime(event.create_time),
        "update_time": _format_datetime(event.update_time),
    }


def _paginate(
    *,
    request: Request,
    view: APIView,
    queryset: QuerySet[Any],
    serializer: callable,
) -> Response:
    paginator = CompatibilityPagination()
    page = paginator.paginate_queryset(queryset, request, view=view)
    rows = [serializer(item) for item in (page or queryset)]
    if page is not None:
        return paginator.get_paginated_response(rows)
    return Response(rows)


def _filter_invites_by_status(queryset: QuerySet[OrganizationInvite], status_filter: str) -> QuerySet[OrganizationInvite]:
    normalized_status = status_filter.strip().upper()
    now = timezone.now()
    if normalized_status == "EXPIRED":
        return queryset.filter(status="PENDING", expires_at__lte=now)
    if normalized_status == "PENDING":
        return queryset.filter(status="PENDING", expires_at__gt=now)
    return queryset.filter(status__iexact=normalized_status)


def _filter_password_resets_by_status(
    queryset: QuerySet[OrganizationPasswordReset],
    status_filter: str,
) -> QuerySet[OrganizationPasswordReset]:
    normalized_status = status_filter.strip().upper()
    now = timezone.now()
    if normalized_status == "EXPIRED":
        return queryset.filter(status="PENDING", expires_at__lte=now)
    if normalized_status == "PENDING":
        return queryset.filter(status="PENDING", expires_at__gt=now)
    return queryset.filter(status__iexact=normalized_status)


class CompatibilityMyMembershipListAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request) -> Response:
        memberships = get_active_memberships_for_user(request.user)
        current_membership = _get_current_membership(request)
        paginator = CompatibilityPagination()
        page = paginator.paginate_queryset(memberships, request, view=self)
        membership_rows = [
            _serialize_membership(
                membership,
                current_membership_id=current_membership.id if current_membership is not None else None,
            )
            for membership in (page or memberships)
        ]
        if page is not None:
            return paginator.get_paginated_response(membership_rows)
        return Response(membership_rows)


class CompatibilityMembershipActivateAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def post(self, request: Request, membership_id: int) -> Response:
        membership = (
            OrganizationMembership.objects.select_related("organization", "user", "staff_profile", "staff_profile__default_warehouse")
            .prefetch_related("role_assignments__role")
            .filter(
                id=membership_id,
                user=request.user,
                is_active=True,
                organization__is_active=True,
            )
            .first()
        )
        if membership is None:
            return Response({"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)

        current_membership = _get_current_membership(request)
        if current_membership is not None:
            current_profile = get_membership_staff_profile(current_membership)
            OrganizationAccessAuditEvent.objects.create(
                organization=membership.organization,
                membership=membership,
                action_type=OrganizationAccessAuditAction.MEMBERSHIP_SWITCHED,
                actor_name=current_profile.staff_name if current_profile is not None else current_membership.user.display_name,
                target_identifier=membership.user.username or membership.user.email,
                payload={"membership_id": membership.id},
            )
        return Response(build_authenticated_response(membership=membership))


class CompatibilityCompanyMembershipListCreateAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"count": 0, "next": None, "previous": None, "results": []})
        queryset = (
            OrganizationMembership.objects.select_related(
                "organization",
                "user",
                "staff_profile",
                "staff_profile__default_warehouse",
            )
            .prefetch_related("role_assignments__role")
            .filter(organization_id=current_membership.organization_id)
            .order_by("user__username", "user__email", "id")
        )
        username_filter = str(request.query_params.get("auth_user__username__icontains") or "").strip()
        if username_filter:
            queryset = queryset.filter(
                Q(user__username__icontains=username_filter) | Q(user__email__icontains=username_filter)
            )
        staff_type_filter = str(request.query_params.get("staff__staff_type") or "").strip()
        if staff_type_filter:
            queryset = queryset.filter(staff_profile__staff_type__iexact=staff_type_filter)
        return _paginate(
            request=request,
            view=self,
            queryset=queryset,
            serializer=lambda membership: _serialize_membership(
                membership,
                current_membership_id=current_membership.id,
            ),
        )

    def post(self, request: Request) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = CompatibilityCompanyMembershipSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = create_company_membership(
            MembershipAdminInput(
                organization=current_membership.organization,
                actor_membership=current_membership,
                username=serializer.validated_data["username"],
                email=serializer.validated_data["email"],
                password=serializer.validated_data.get("password", ""),
                staff_name=serializer.validated_data["staff_name"],
                staff_type=serializer.validated_data["staff_type"],
                check_code=serializer.validated_data["check_code"],
                is_lock=serializer.validated_data.get("is_lock", False),
                is_company_admin=serializer.validated_data.get("is_company_admin", False),
                can_manage_users=serializer.validated_data.get("can_manage_users", False),
                is_active=serializer.validated_data.get("is_active", True),
                default_warehouse_id=serializer.validated_data.get("default_warehouse"),
            )
        )
        membership = (
            OrganizationMembership.objects.select_related(
                "organization",
                "user",
                "staff_profile",
                "staff_profile__default_warehouse",
            )
            .prefetch_related("role_assignments__role")
            .get(id=membership.id)
        )
        return Response(
            _serialize_membership(membership, current_membership_id=current_membership.id),
            status=status.HTTP_201_CREATED,
        )


class CompatibilityCompanyMembershipDetailAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request, membership_id: int) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)
        membership = self._get_membership(current_membership, membership_id)
        if membership is None:
            return Response({"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_membership(membership, current_membership_id=current_membership.id))

    def patch(self, request: Request, membership_id: int) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)
        membership = self._get_membership(current_membership, membership_id)
        if membership is None:
            return Response({"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = CompatibilityCompanyMembershipSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        existing_profile = get_membership_staff_profile(membership)
        updated = update_company_membership(
            actor_membership=current_membership,
            membership=membership,
            payload=MembershipAdminInput(
                organization=current_membership.organization,
                actor_membership=current_membership,
                username=serializer.validated_data.get("username", membership.user.username or membership.user.email),
                email=serializer.validated_data.get("email", membership.user.email),
                password=serializer.validated_data.get("password", ""),
                staff_name=serializer.validated_data.get(
                    "staff_name",
                    existing_profile.staff_name if isinstance(existing_profile, OrganizationStaffProfile) else membership.user.display_name,
                ),
                staff_type=serializer.validated_data.get(
                    "staff_type",
                    existing_profile.staff_type if isinstance(existing_profile, OrganizationStaffProfile) else get_membership_display_role(membership),
                ),
                check_code=serializer.validated_data.get(
                    "check_code",
                    existing_profile.check_code if isinstance(existing_profile, OrganizationStaffProfile) else 8888,
                ),
                is_lock=serializer.validated_data.get(
                    "is_lock",
                    existing_profile.is_lock if isinstance(existing_profile, OrganizationStaffProfile) else False,
                ),
                is_company_admin=serializer.validated_data.get(
                    "is_company_admin",
                    is_company_admin_membership(membership),
                ),
                can_manage_users=serializer.validated_data.get(
                    "can_manage_users",
                    can_manage_users(membership),
                ),
                is_active=serializer.validated_data.get("is_active", membership.is_active),
                default_warehouse_id=serializer.validated_data.get(
                    "default_warehouse",
                    existing_profile.default_warehouse_id if isinstance(existing_profile, OrganizationStaffProfile) else None,
                ),
            ),
        )
        updated = (
            OrganizationMembership.objects.select_related(
                "organization",
                "user",
                "staff_profile",
                "staff_profile__default_warehouse",
            )
            .prefetch_related("role_assignments__role")
            .get(id=updated.id)
        )
        return Response(_serialize_membership(updated, current_membership_id=current_membership.id))

    def _get_membership(
        self,
        current_membership: OrganizationMembership,
        membership_id: int,
    ) -> OrganizationMembership | None:
        return (
            OrganizationMembership.objects.select_related(
                "organization",
                "user",
                "staff_profile",
                "staff_profile__default_warehouse",
            )
            .prefetch_related("role_assignments__role")
            .filter(id=membership_id, organization_id=current_membership.organization_id)
            .first()
        )


class CompatibilityInviteListCreateAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"count": 0, "next": None, "previous": None, "results": []})
        queryset = (
            OrganizationInvite.objects.select_related(
                "organization",
                "default_warehouse",
                "accepted_membership",
                "accepted_membership__user",
            )
            .filter(organization_id=current_membership.organization_id)
            .order_by("-create_time", "-id")
        )
        email_filter = str(request.query_params.get("email__icontains") or "").strip()
        if email_filter:
            queryset = queryset.filter(email__icontains=email_filter)
        status_filter = str(request.query_params.get("status") or "").strip()
        if status_filter:
            queryset = _filter_invites_by_status(queryset, status_filter)
        return _paginate(request=request, view=self, queryset=queryset, serializer=_serialize_invite)

    def post(self, request: Request) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = CompatibilityInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invite = create_invite(
            InviteCreateInput(
                organization=current_membership.organization,
                actor_membership=current_membership,
                email=serializer.validated_data["email"],
                staff_name=serializer.validated_data["staff_name"],
                staff_type=serializer.validated_data["staff_type"],
                check_code=serializer.validated_data["check_code"],
                default_warehouse_id=serializer.validated_data.get("default_warehouse"),
                is_company_admin=serializer.validated_data.get("is_company_admin", False),
                can_manage_users=serializer.validated_data.get("can_manage_users", False),
                invite_message=serializer.validated_data.get("invite_message", ""),
                expires_in_days=serializer.validated_data.get("expires_in_days", 7),
            )
        )
        invite = (
            OrganizationInvite.objects.select_related(
                "organization",
                "default_warehouse",
                "accepted_membership",
                "accepted_membership__user",
            )
            .get(id=invite.id)
        )
        return Response(_serialize_invite(invite), status=status.HTTP_201_CREATED)


class CompatibilityInviteAcceptanceAPIView(APIView):
    authentication_classes: list[type[object]] = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = CompatibilityInviteAcceptanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = accept_invite(InviteAcceptanceInput(**serializer.validated_data))
        return Response(payload, status=status.HTTP_201_CREATED)


class CompatibilityInviteDetailAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request, invite_id: int) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"detail": "Invite not found."}, status=status.HTTP_404_NOT_FOUND)
        invite = self._get_invite(current_membership, invite_id)
        if invite is None:
            return Response({"detail": "Invite not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_invite(invite))

    def post(self, request: Request, invite_id: int) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"detail": "Invite not found."}, status=status.HTTP_404_NOT_FOUND)
        invite = self._get_invite(current_membership, invite_id)
        if invite is None:
            return Response({"detail": "Invite not found."}, status=status.HTTP_404_NOT_FOUND)
        invite = revoke_invite(actor_membership=current_membership, invite=invite)
        invite = (
            OrganizationInvite.objects.select_related(
                "organization",
                "default_warehouse",
                "accepted_membership",
                "accepted_membership__user",
            )
            .get(id=invite.id)
        )
        return Response(_serialize_invite(invite))

    def _get_invite(self, current_membership: OrganizationMembership, invite_id: int) -> OrganizationInvite | None:
        return (
            OrganizationInvite.objects.select_related(
                "organization",
                "default_warehouse",
                "accepted_membership",
                "accepted_membership__user",
            )
            .filter(id=invite_id, organization_id=current_membership.organization_id)
            .first()
        )


class CompatibilityPasswordResetListCreateAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"count": 0, "next": None, "previous": None, "results": []})
        queryset = (
            OrganizationPasswordReset.objects.select_related(
                "organization",
                "membership",
                "membership__user",
                "membership__staff_profile",
            )
            .filter(organization_id=current_membership.organization_id)
            .order_by("-create_time", "-id")
        )
        username_filter = str(request.query_params.get("membership__auth_user__username__icontains") or "").strip()
        if username_filter:
            queryset = queryset.filter(
                Q(membership__user__username__icontains=username_filter)
                | Q(membership__user__email__icontains=username_filter)
            )
        status_filter = str(request.query_params.get("status") or "").strip()
        if status_filter:
            queryset = _filter_password_resets_by_status(queryset, status_filter)
        return _paginate(request=request, view=self, queryset=queryset, serializer=_serialize_password_reset)

    def post(self, request: Request) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)
        serializer = CompatibilityPasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_membership = (
            OrganizationMembership.objects.filter(
                id=serializer.validated_data["membership"],
                organization_id=current_membership.organization_id,
            )
            .first()
        )
        if target_membership is None:
            return Response({"detail": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)
        password_reset = issue_password_reset(
            PasswordResetCreateInput(
                organization=current_membership.organization,
                actor_membership=current_membership,
                membership=target_membership,
                expires_in_hours=serializer.validated_data.get("expires_in_hours", 24),
                notes=serializer.validated_data.get("notes", ""),
            )
        )
        password_reset = (
            OrganizationPasswordReset.objects.select_related(
                "organization",
                "membership",
                "membership__user",
                "membership__staff_profile",
            )
            .get(id=password_reset.id)
        )
        return Response(_serialize_password_reset(password_reset), status=status.HTTP_201_CREATED)


class CompatibilityPasswordResetCompletionAPIView(APIView):
    authentication_classes: list[type[object]] = []
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = CompatibilityPasswordResetCompletionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password_reset = complete_password_reset(
            PasswordResetCompletionInput(**serializer.validated_data)
        )
        return Response(
            {
                "detail": "Password updated",
                "company_name": password_reset.organization.name,
                "username": password_reset.membership.user.username or password_reset.membership.user.email,
            },
            status=status.HTTP_200_OK,
        )


class CompatibilityPasswordResetDetailAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request, reset_id: int) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"detail": "Password reset not found."}, status=status.HTTP_404_NOT_FOUND)
        password_reset = self._get_reset(current_membership, reset_id)
        if password_reset is None:
            return Response({"detail": "Password reset not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(_serialize_password_reset(password_reset))

    def post(self, request: Request, reset_id: int) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"detail": "Password reset not found."}, status=status.HTTP_404_NOT_FOUND)
        password_reset = self._get_reset(current_membership, reset_id)
        if password_reset is None:
            return Response({"detail": "Password reset not found."}, status=status.HTTP_404_NOT_FOUND)
        password_reset = revoke_password_reset(actor_membership=current_membership, password_reset=password_reset)
        password_reset = (
            OrganizationPasswordReset.objects.select_related(
                "organization",
                "membership",
                "membership__user",
                "membership__staff_profile",
            )
            .get(id=password_reset.id)
        )
        return Response(_serialize_password_reset(password_reset))

    def _get_reset(
        self,
        current_membership: OrganizationMembership,
        reset_id: int,
    ) -> OrganizationPasswordReset | None:
        return (
            OrganizationPasswordReset.objects.select_related(
                "organization",
                "membership",
                "membership__user",
                "membership__staff_profile",
            )
            .filter(id=reset_id, organization_id=current_membership.organization_id)
            .first()
        )


class CompatibilityAuditEventListAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request) -> Response:
        current_membership = _get_current_membership(request)
        if current_membership is None:
            return Response({"count": 0, "next": None, "previous": None, "results": []})
        queryset = (
            OrganizationAccessAuditEvent.objects.select_related(
                "organization",
                "membership",
                "membership__user",
                "invite",
                "password_reset",
                "password_reset__membership",
                "password_reset__membership__user",
            )
            .filter(organization_id=current_membership.organization_id)
            .order_by("-occurred_at", "-id")
        )
        target_filter = str(request.query_params.get("target_identifier__icontains") or "").strip()
        if target_filter:
            queryset = queryset.filter(target_identifier__icontains=target_filter)
        action_filter = str(request.query_params.get("action_type") or "").strip()
        if action_filter:
            queryset = queryset.filter(action_type__icontains=action_filter)
        return _paginate(request=request, view=self, queryset=queryset, serializer=_serialize_audit_event)


class CompatibilityWorkspaceTabListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        paginator = CompatibilityPagination()
        page = paginator.paginate_queryset([], request, view=self)
        if page is not None:
            return paginator.get_paginated_response([])
        return Response([])


class CompatibilityWorkspaceTabSyncAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        current_membership = _get_current_membership(request)
        timestamp = _format_datetime(timezone.now())
        payload = {
            "id": 0,
            "membership_id": current_membership.id if current_membership is not None else 0,
            "route_key": str(request.data.get("route_key") or ""),
            "route_path": str(request.data.get("route_path") or ""),
            "title": str(request.data.get("title") or ""),
            "icon_key": str(request.data.get("icon_key") or ""),
            "position": 0,
            "is_active": bool(request.data.get("is_active", True)),
            "is_pinned": bool(request.data.get("is_pinned", False)),
            "state_payload": request.data.get("state_payload") or {},
            "context_payload": request.data.get("context_payload") or {},
            "last_opened_at": timestamp,
            "create_time": timestamp,
            "update_time": timestamp,
        }
        return Response(payload, status=status.HTTP_201_CREATED)


class CompatibilityWorkbenchPreferenceAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        return Response(self._build_payload(request))

    def patch(self, request: Request) -> Response:
        return Response(self._build_payload(request, overrides=request.data))

    def _build_payload(
        self,
        request: Request,
        *,
        overrides: dict[str, Any] | None = None,
    ) -> dict[str, object]:
        current_membership = _get_current_membership(request)
        timestamp = _format_datetime(timezone.now())
        base_payload: dict[str, object] = {
            "id": 0,
            "membership_id": current_membership.id if current_membership is not None else 0,
            "page_key": str(request.query_params.get("page_key") or request.data.get("page_key") or "dashboard"),
            "time_window": "7d",
            "visible_widget_keys": [],
            "right_rail_widget_keys": [],
            "layout_payload": {},
            "create_time": timestamp,
            "update_time": timestamp,
        }
        if overrides:
            base_payload.update(
                {
                    "page_key": str(overrides.get("page_key") or base_payload["page_key"]),
                    "time_window": str(overrides.get("time_window") or base_payload["time_window"]),
                    "visible_widget_keys": list(overrides.get("visible_widget_keys") or []),
                    "right_rail_widget_keys": list(overrides.get("right_rail_widget_keys") or []),
                    "layout_payload": overrides.get("layout_payload") or {},
                }
            )
        return base_payload
