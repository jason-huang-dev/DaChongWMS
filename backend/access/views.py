"""API views for company context, browser account provisioning, invites, and access audit."""

from __future__ import annotations

from typing import Any, Sequence

from django.contrib.auth import get_user_model
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import APIException, PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from utils.operator import get_request_operator
from utils.page import MyPageNumberPagination
from userlogin.services import build_auth_response_data, resolve_workspace_identity

from .filter import (
    AccessAuditEventFilter,
    CompanyInviteFilter,
    CompanyMembershipFilter,
    CompanyPasswordResetFilter,
    QueueViewPreferenceFilter,
    WorkspaceTabPreferenceFilter,
    WorkbenchPreferenceFilter,
)
from .models import (
    AccessAuditEvent,
    CompanyInvite,
    CompanyMembership,
    CompanyPasswordReset,
    QueueViewPreference,
    WorkspaceTabPreference,
    WorkbenchPreference,
)
from .permissions import CanManageCompanyMembers
from .serializers import (
    AccessAuditEventSerializer,
    CompanyInviteAcceptSerializer,
    CompanyInviteCreateSerializer,
    CompanyInviteSerializer,
    CompanyMembershipProvisionSerializer,
    CompanyMembershipSerializer,
    CompanyMembershipUpdateSerializer,
    CompanyPasswordResetCompleteSerializer,
    CompanyPasswordResetCreateSerializer,
    CompanyPasswordResetSerializer,
    MyCompanyMembershipSerializer,
    QueueViewPreferenceSerializer,
    QueueViewPreferenceWriteSerializer,
    WorkspaceTabPreferenceSerializer,
    WorkspaceTabSyncSerializer,
    WorkbenchPreferenceSerializer,
    WorkbenchPreferenceWriteSerializer,
)
from .services import (
    CompanyInviteAcceptPayload,
    CompanyInviteCreatePayload,
    CompanyPasswordResetCompletePayload,
    CompanyPasswordResetCreatePayload,
    WorkbenchPreferencePayload,
    WorkspaceTabSyncPayload,
    accept_company_invite,
    activate_membership,
    activate_workspace_tab,
    close_workspace_tab,
    create_company_invite,
    get_preferred_membership_for_auth_user,
    issue_company_password_reset,
    provision_company_user,
    require_company_access_manager,
    revoke_company_invite,
    revoke_company_password_reset,
    sync_workspace_tab,
    update_company_membership,
    complete_company_password_reset,
    upsert_workbench_preference,
)


class TenantScopedViewSet(viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time", "last_selected_at"]
    permission_classes = []
    queryset = None

    def _current_openid(self) -> str:
        openid = getattr(self.request.auth, "openid", None)
        if not isinstance(openid, str) or not openid:
            raise APIException({"detail": "Authentication token missing openid"})
        return openid

    def _current_auth_user(self):
        auth_user_id = getattr(self.request.auth, "user_id", None)
        if not isinstance(auth_user_id, int):
            raise APIException({"detail": "Authenticated user id is missing"})
        auth_user = get_user_model().objects.filter(id=auth_user_id).first()
        if auth_user is None:
            raise APIException({"detail": "Authenticated browser user was not found"})
        return auth_user

    def _current_membership(self) -> CompanyMembership:
        profile_token = getattr(self.request.auth, "profile_token", None)
        membership = get_preferred_membership_for_auth_user(
            auth_user=self._current_auth_user(),
            company_openid=self._current_openid(),
            profile_token=profile_token if isinstance(profile_token, str) else None,
        )
        if membership is None:
            raise PermissionDenied({"detail": "No active company membership matches the authenticated context"})
        return membership


class MyCompanyMembershipViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, TenantScopedViewSet):
    serializer_class = MyCompanyMembershipSerializer
    filterset_class = CompanyMembershipFilter
    search_fields = ["company__company_name", "staff__staff_name", "auth_user__username", "auth_user__email"]

    def get_queryset(self):  # type: ignore[override]
        return (
            CompanyMembership.objects.select_related("company", "auth_user", "profile", "staff", "default_warehouse")
            .filter(auth_user=self._current_auth_user(), is_delete=False, is_active=True)
            .order_by("-last_selected_at", "company__company_name", "id")
        )

    def get_serializer_context(self) -> dict[str, Any]:
        context = super().get_serializer_context()
        current_membership = self._current_membership()
        context["current_membership_id"] = current_membership.id
        return context

    def activate(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        membership = self.get_object()
        if membership.auth_user_id != self._current_auth_user().id:
            raise PermissionDenied({"detail": "Membership does not belong to the authenticated browser user"})
        operator = get_request_operator(request)
        membership = activate_membership(membership=membership, operator_name=operator.staff_name)
        identity = resolve_workspace_identity(auth_user=membership.auth_user, profile_token=membership.profile.openid)
        return Response(build_auth_response_data(identity=identity, mfa_enrollment_required=False), status=status.HTTP_200_OK)


class CompanyMembershipViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    TenantScopedViewSet,
):
    queryset = CompanyMembership.objects.select_related("company", "auth_user", "profile", "staff", "default_warehouse")
    serializer_class = CompanyMembershipSerializer
    filterset_class = CompanyMembershipFilter
    permission_classes = [CanManageCompanyMembers]
    search_fields = ["auth_user__username", "auth_user__email", "staff__staff_name", "staff__staff_type"]

    def get_queryset(self):  # type: ignore[override]
        return self.queryset.filter(company__openid=self._current_openid(), is_delete=False)

    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        require_company_access_manager(membership=self._current_membership())
        return super().list(request, *args, **kwargs)

    def retrieve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        require_company_access_manager(membership=self._current_membership())
        return super().retrieve(request, *args, **kwargs)

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        current_membership = self._current_membership()
        require_company_access_manager(membership=current_membership)
        serializer = CompanyMembershipProvisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        result = provision_company_user(
            company=current_membership.company,
            operator_name=operator.staff_name,
            username=serializer.validated_data["username"],
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            staff_name=serializer.validated_data["staff_name"],
            staff_type=serializer.validated_data["staff_type"],
            check_code=serializer.validated_data["check_code"],
            is_lock=serializer.validated_data.get("is_lock", False),
            is_company_admin=serializer.validated_data.get("is_company_admin", False),
            can_manage_users=serializer.validated_data.get("can_manage_users", False),
            default_warehouse=serializer.validated_data.get("default_warehouse"),
        )
        response_serializer = self.get_serializer(result.membership)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        current_membership = self._current_membership()
        require_company_access_manager(membership=current_membership)
        membership = self.get_object()
        serializer = CompanyMembershipUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        membership = update_company_membership(
            membership=membership,
            operator_name=operator.staff_name,
            email=serializer.validated_data["email"],
            staff_name=serializer.validated_data["staff_name"],
            staff_type=serializer.validated_data["staff_type"],
            check_code=serializer.validated_data["check_code"],
            is_lock=serializer.validated_data.get("is_lock", False),
            is_company_admin=serializer.validated_data.get("is_company_admin", False),
            can_manage_users=serializer.validated_data.get("can_manage_users", False),
            is_active=serializer.validated_data.get("is_active", True),
            default_warehouse=serializer.validated_data.get("default_warehouse"),
            password=serializer.validated_data.get("password", ""),
        )
        return Response(self.get_serializer(membership).data, status=status.HTTP_200_OK)


class CompanyInviteViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = CompanyInvite.objects.select_related("company", "default_warehouse", "accepted_membership", "accepted_membership__auth_user")
    serializer_class = CompanyInviteSerializer
    filterset_class = CompanyInviteFilter
    permission_classes = [CanManageCompanyMembers]
    search_fields = ["email", "staff_name", "staff_type", "invited_by"]
    ordering_fields = ["id", "create_time", "expires_at", "accepted_at", "update_time"]

    def get_queryset(self):  # type: ignore[override]
        return self.queryset.filter(company__openid=self._current_openid(), is_delete=False)

    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        require_company_access_manager(membership=self._current_membership())
        return super().list(request, *args, **kwargs)

    def retrieve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        require_company_access_manager(membership=self._current_membership())
        return super().retrieve(request, *args, **kwargs)

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        current_membership = self._current_membership()
        require_company_access_manager(membership=current_membership)
        serializer = CompanyInviteCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        invite = create_company_invite(
            company=current_membership.company,
            operator_name=operator.staff_name,
            payload=CompanyInviteCreatePayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(invite).data, status=status.HTTP_201_CREATED)

    def revoke(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        current_membership = self._current_membership()
        require_company_access_manager(membership=current_membership)
        invite = self.get_object()
        operator = get_request_operator(request)
        invite = revoke_company_invite(invite=invite, operator_name=operator.staff_name)
        return Response(self.get_serializer(invite).data, status=status.HTTP_200_OK)


class InviteAcceptanceViewSet(viewsets.GenericViewSet):
    permission_classes = [AllowAny]
    authentication_classes: Sequence[type[Any]] = []

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = CompanyInviteAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = accept_company_invite(payload=CompanyInviteAcceptPayload(**serializer.validated_data))
        return Response(payload, status=status.HTTP_201_CREATED)


class CompanyPasswordResetViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = CompanyPasswordReset.objects.select_related("company", "membership", "membership__auth_user", "membership__staff")
    serializer_class = CompanyPasswordResetSerializer
    filterset_class = CompanyPasswordResetFilter
    permission_classes = [CanManageCompanyMembers]
    search_fields = ["membership__auth_user__username", "membership__auth_user__email", "membership__staff__staff_name", "issued_by"]
    ordering_fields = ["id", "create_time", "expires_at", "completed_at", "update_time"]

    def get_queryset(self):  # type: ignore[override]
        return self.queryset.filter(company__openid=self._current_openid(), is_delete=False)

    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        require_company_access_manager(membership=self._current_membership())
        return super().list(request, *args, **kwargs)

    def retrieve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        require_company_access_manager(membership=self._current_membership())
        return super().retrieve(request, *args, **kwargs)

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        current_membership = self._current_membership()
        require_company_access_manager(membership=current_membership)
        serializer = CompanyPasswordResetCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership = serializer.validated_data["membership"]
        if membership.company_id != current_membership.company_id:
            raise PermissionDenied({"detail": "Password resets can only be issued for members of the active company"})
        operator = get_request_operator(request)
        password_reset = issue_company_password_reset(
            operator_name=operator.staff_name,
            payload=CompanyPasswordResetCreatePayload(
                membership=membership,
                expires_in_hours=serializer.validated_data.get("expires_in_hours", 24),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        return Response(self.get_serializer(password_reset).data, status=status.HTTP_201_CREATED)

    def revoke(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        current_membership = self._current_membership()
        require_company_access_manager(membership=current_membership)
        password_reset = self.get_object()
        operator = get_request_operator(request)
        password_reset = revoke_company_password_reset(password_reset=password_reset, operator_name=operator.staff_name)
        return Response(self.get_serializer(password_reset).data, status=status.HTTP_200_OK)


class PasswordResetCompletionViewSet(viewsets.GenericViewSet):
    permission_classes = [AllowAny]
    authentication_classes: Sequence[type[Any]] = []

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = CompanyPasswordResetCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password_reset = complete_company_password_reset(
            payload=CompanyPasswordResetCompletePayload(**serializer.validated_data),
        )
        return Response(
            {
                "detail": "Password updated",
                "company_name": password_reset.company.company_name,
                "username": password_reset.membership.auth_user.username,
            },
            status=status.HTTP_200_OK,
        )


class AccessAuditEventViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, TenantScopedViewSet):
    queryset = AccessAuditEvent.objects.select_related(
        "company",
        "membership",
        "membership__auth_user",
        "invite",
        "password_reset",
        "password_reset__membership",
        "password_reset__membership__auth_user",
    )
    serializer_class = AccessAuditEventSerializer
    filterset_class = AccessAuditEventFilter
    permission_classes = [CanManageCompanyMembers]
    search_fields = ["actor_name", "target_identifier", "invite__email", "membership__auth_user__username"]
    ordering_fields = ["occurred_at", "create_time", "id"]

    def get_queryset(self):  # type: ignore[override]
        return self.queryset.filter(company__openid=self._current_openid(), is_delete=False)

    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        require_company_access_manager(membership=self._current_membership())
        return super().list(request, *args, **kwargs)

    def retrieve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        require_company_access_manager(membership=self._current_membership())
        return super().retrieve(request, *args, **kwargs)


class QueueViewPreferenceViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    TenantScopedViewSet,
):
    queryset = QueueViewPreference.objects.select_related("membership", "membership__company", "warehouse")
    serializer_class = QueueViewPreferenceSerializer
    filterset_class = QueueViewPreferenceFilter
    search_fields = ["route_key", "name", "status_bucket", "search_scope"]
    ordering_fields = ["route_key", "name", "last_used_at", "create_time", "id"]

    def get_queryset(self):  # type: ignore[override]
        return self.queryset.filter(membership=self._current_membership(), is_delete=False)

    def get_serializer_class(self):  # type: ignore[override]
        if self.action in {"create", "partial_update"}:
            return QueueViewPreferenceWriteSerializer
        return QueueViewPreferenceSerializer

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        membership = self._current_membership()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        warehouse = serializer.validated_data.get("warehouse")
        if warehouse is not None and warehouse.openid != membership.company.openid:
            raise PermissionDenied({"detail": "Queue views can only target warehouses from the active company"})
        preference = QueueViewPreference.objects.create(
            membership=membership,
            creator=get_request_operator(request).staff_name,
            openid=membership.company.openid,
            **serializer.validated_data,
        )
        return Response(QueueViewPreferenceSerializer(preference).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        membership = self._current_membership()
        preference = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        warehouse = serializer.validated_data.get("warehouse")
        if warehouse is not None and warehouse.openid != membership.company.openid:
            raise PermissionDenied({"detail": "Queue views can only target warehouses from the active company"})
        for field, value in serializer.validated_data.items():
            setattr(preference, field, value)
        update_fields = [*serializer.validated_data.keys(), "update_time"]
        preference.save(update_fields=update_fields)
        return Response(QueueViewPreferenceSerializer(preference).data, status=status.HTTP_200_OK)

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        preference = self.get_object()
        preference.is_delete = True
        preference.save(update_fields=["is_delete", "update_time"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkspaceTabPreferenceViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    TenantScopedViewSet,
):
    queryset = WorkspaceTabPreference.objects.select_related("membership", "membership__company")
    serializer_class = WorkspaceTabPreferenceSerializer
    filterset_class = WorkspaceTabPreferenceFilter
    search_fields = ["route_key", "route_path", "title", "icon_key"]
    ordering_fields = ["position", "last_opened_at", "create_time", "id"]

    def get_queryset(self):  # type: ignore[override]
        return self.queryset.filter(membership=self._current_membership(), is_delete=False)

    def sync(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        membership = self._current_membership()
        serializer = WorkspaceTabSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tab = sync_workspace_tab(
            membership=membership,
            operator_name=get_request_operator(request).staff_name,
            payload=WorkspaceTabSyncPayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(tab).data, status=status.HTTP_200_OK)

    def activate(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        tab = activate_workspace_tab(tab=self.get_object())
        return Response(self.get_serializer(tab).data, status=status.HTTP_200_OK)

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        close_workspace_tab(tab=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)


class WorkbenchPreferenceViewSet(TenantScopedViewSet):
    queryset = WorkbenchPreference.objects.select_related("membership", "membership__company")
    serializer_class = WorkbenchPreferenceSerializer
    filterset_class = WorkbenchPreferenceFilter
    search_fields = ["page_key"]
    ordering_fields = ["page_key", "update_time", "id"]

    def get_queryset(self):  # type: ignore[override]
        return self.queryset.filter(membership=self._current_membership(), is_delete=False)

    def current(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        membership = self._current_membership()
        if request.method == "GET":
            page_key = str(request.query_params.get("page_key", "dashboard"))
            preference = upsert_workbench_preference(
                membership=membership,
                operator_name=get_request_operator(request).staff_name,
                payload=WorkbenchPreferencePayload(page_key=page_key),
            )
            return Response(self.get_serializer(preference).data, status=status.HTTP_200_OK)

        serializer = WorkbenchPreferenceWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        preference = upsert_workbench_preference(
            membership=membership,
            operator_name=get_request_operator(request).staff_name,
            payload=WorkbenchPreferencePayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(preference).data, status=status.HTTP_200_OK)
