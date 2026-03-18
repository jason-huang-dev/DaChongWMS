"""Service helpers for company membership, invitations, resets, and access auditing."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied, ValidationError

from staff.models import ListModel as Staff
from userprofile.models import Users
from utils.md5 import Md5
from warehouse.models import Warehouse

from .models import (
    AccessAuditAction,
    AccessAuditEvent,
    Company,
    CompanyInvite,
    CompanyInviteStatus,
    CompanyMembership,
    CompanyPasswordReset,
    CompanyPasswordResetStatus,
    CompanyStatus,
    QueueViewPreference,
    WorkspaceTabPreference,
    WorkbenchPreference,
)

COMPANY_ADMIN_ROLES = {"Manager", "Supervisor"}


@dataclass(frozen=True)
class ProvisionedMembershipResult:
    auth_user: object
    profile: Users
    staff: Staff
    company: Company
    membership: CompanyMembership


@dataclass(frozen=True)
class CompanyInviteCreatePayload:
    email: str
    staff_name: str
    staff_type: str
    check_code: int
    default_warehouse: Warehouse | None
    is_company_admin: bool
    can_manage_users: bool
    invite_message: str
    expires_in_days: int


@dataclass(frozen=True)
class CompanyInviteAcceptPayload:
    invite_token: str
    username: str
    password: str


@dataclass(frozen=True)
class CompanyPasswordResetCreatePayload:
    membership: CompanyMembership
    expires_in_hours: int
    notes: str


@dataclass(frozen=True)
class CompanyPasswordResetCompletePayload:
    reset_token: str
    password: str


@dataclass(frozen=True)
class WorkspaceTabSyncPayload:
    route_key: str
    route_path: str
    title: str
    icon_key: str
    is_active: bool
    is_pinned: bool
    state_payload: dict[str, object]
    context_payload: dict[str, object]


@dataclass(frozen=True)
class WorkbenchPreferencePayload:
    page_key: str
    time_window: str | None = None
    visible_widget_keys: list[str] | None = None
    right_rail_widget_keys: list[str] | None = None
    layout_payload: dict[str, object] | None = None


def role_grants_company_admin(role: str) -> bool:
    return role in COMPANY_ADMIN_ROLES


def membership_can_manage_users(membership: CompanyMembership) -> bool:
    return membership.is_active and (
        membership.is_company_admin or membership.can_manage_users or role_grants_company_admin(membership.staff.staff_type)
    )


def build_company_code(*, name: str, openid: str) -> str:
    slug = slugify(name).replace("-", "_")[:32]
    return slug or f"company_{openid[:8]}"


def build_default_company_name(*, staff_name: str) -> str:
    return f"{staff_name} Workspace"


def generate_profile_token(*, company_openid: str, username: str) -> str:
    return Md5.md5(f"{company_openid}:{username}:{secrets.token_hex(8)}")


def generate_invite_token() -> str:
    return secrets.token_urlsafe(24)


def generate_password_reset_token() -> str:
    return secrets.token_urlsafe(24)


def get_default_warehouse_for_openid(openid: str) -> Warehouse | None:
    return Warehouse.objects.filter(openid=openid, is_delete=False).order_by("id").first()


@transaction.atomic
def append_access_audit_event(
    *,
    company: Company,
    operator_name: str,
    action_type: str,
    target_identifier: str = "",
    membership: CompanyMembership | None = None,
    invite: CompanyInvite | None = None,
    password_reset: CompanyPasswordReset | None = None,
    payload: dict[str, object] | None = None,
) -> AccessAuditEvent:
    return AccessAuditEvent.objects.create(
        company=company,
        membership=membership,
        invite=invite,
        password_reset=password_reset,
        action_type=action_type,
        actor_name=operator_name,
        target_identifier=target_identifier,
        payload=payload or {},
        creator=operator_name,
        openid=company.openid,
    )


@transaction.atomic
def get_or_create_company_for_openid(
    *,
    openid: str,
    creator: str,
    company_name: str,
    default_warehouse: Warehouse | None = None,
) -> Company:
    company, _ = Company.objects.get_or_create(
        openid=openid,
        is_delete=False,
        defaults={
            "company_name": company_name,
            "company_code": build_company_code(name=company_name, openid=openid),
            "description": f"Tenant workspace for {company_name}",
            "status": CompanyStatus.ACTIVE,
            "default_warehouse": default_warehouse,
            "creator": creator,
        },
    )
    update_fields: list[str] = []
    if company.company_name != company_name and not company.company_name:
        company.company_name = company_name
        update_fields.append("company_name")
    if company.default_warehouse_id is None and default_warehouse is not None:
        company.default_warehouse = default_warehouse
        update_fields.append("default_warehouse")
    if update_fields:
        update_fields.append("update_time")
        company.save(update_fields=update_fields)
    return company


@transaction.atomic
def ensure_company_membership(
    *,
    auth_user,
    profile: Users,
    staff: Staff,
    creator: str,
) -> CompanyMembership:
    default_warehouse = get_default_warehouse_for_openid(staff.openid)
    company = get_or_create_company_for_openid(
        openid=staff.openid,
        creator=creator,
        company_name=build_default_company_name(staff_name=staff.staff_name),
        default_warehouse=default_warehouse,
    )
    membership, created = CompanyMembership.objects.get_or_create(
        company=company,
        auth_user=auth_user,
        is_delete=False,
        defaults={
            "profile": profile,
            "staff": staff,
            "default_warehouse": default_warehouse,
            "is_company_admin": role_grants_company_admin(staff.staff_type),
            "can_manage_users": role_grants_company_admin(staff.staff_type),
            "is_active": True,
            "invited_by": creator,
            "creator": creator,
            "openid": company.openid,
        },
    )
    if created:
        append_access_audit_event(
            company=company,
            operator_name=creator,
            membership=membership,
            action_type=AccessAuditAction.MEMBERSHIP_PROVISIONED,
            target_identifier=auth_user.username,
            payload={"source": "ensure_company_membership"},
        )
        return membership

    update_fields: list[str] = []
    if membership.profile_id != profile.id:
        membership.profile = profile
        update_fields.append("profile")
    if membership.staff_id != staff.id:
        membership.staff = staff
        update_fields.append("staff")
    if membership.default_warehouse_id is None and default_warehouse is not None:
        membership.default_warehouse = default_warehouse
        update_fields.append("default_warehouse")
    derived_admin = role_grants_company_admin(staff.staff_type)
    if not membership.is_company_admin and derived_admin:
        membership.is_company_admin = True
        update_fields.append("is_company_admin")
    if not membership.can_manage_users and derived_admin:
        membership.can_manage_users = True
        update_fields.append("can_manage_users")
    if not membership.is_active:
        membership.is_active = True
        update_fields.append("is_active")
    if update_fields:
        update_fields.append("update_time")
        membership.save(update_fields=update_fields)
    return membership


def get_membership_for_profile(profile: Users) -> CompanyMembership | None:
    membership = (
        CompanyMembership.objects.select_related("company", "auth_user", "profile", "staff", "default_warehouse")
        .filter(profile=profile, is_delete=False, is_active=True)
        .order_by("-last_selected_at", "id")
        .first()
    )
    if membership is not None:
        return membership

    auth_user = get_user_model().objects.filter(id=profile.user_id).first()
    if auth_user is None:
        return None
    staff = Staff.objects.filter(openid=profile.openid, staff_name=profile.name, is_delete=False).first()
    if staff is None:
        return None
    return ensure_company_membership(auth_user=auth_user, profile=profile, staff=staff, creator=staff.staff_name)


def get_preferred_membership_for_auth_user(
    *,
    auth_user,
    company_openid: str | None = None,
    profile_token: str | None = None,
) -> CompanyMembership | None:
    queryset = CompanyMembership.objects.select_related("company", "auth_user", "profile", "staff", "default_warehouse").filter(
        auth_user=auth_user,
        is_delete=False,
        is_active=True,
    )
    if company_openid:
        queryset = queryset.filter(company__openid=company_openid)
    if profile_token:
        queryset = queryset.filter(profile__openid=profile_token)
    membership = queryset.order_by("-last_selected_at", "id").first()
    if membership is not None:
        return membership

    profiles = Users.objects.filter(user_id=auth_user.id, is_delete=False)
    if profile_token:
        profiles = profiles.filter(openid=profile_token)
    for profile in profiles.order_by("id"):
        fallback = get_membership_for_profile(profile)
        if fallback is None:
            continue
        if company_openid and fallback.company.openid != company_openid:
            continue
        return fallback
    return None


@transaction.atomic
def activate_membership(*, membership: CompanyMembership, operator_name: str) -> CompanyMembership:
    membership.last_selected_at = timezone.now()
    membership.creator = membership.creator or operator_name
    membership.save(update_fields=["last_selected_at", "update_time"])
    append_access_audit_event(
        company=membership.company,
        operator_name=operator_name,
        membership=membership,
        action_type=AccessAuditAction.MEMBERSHIP_SWITCHED,
        target_identifier=membership.auth_user.username,
        payload={"membership_id": membership.id},
    )
    return membership


def require_company_access_manager(*, membership: CompanyMembership) -> None:
    if not membership_can_manage_users(membership):
        raise PermissionDenied({"detail": "Only company admins or user managers can manage company memberships"})


@transaction.atomic
def provision_company_user(
    *,
    company: Company,
    operator_name: str,
    username: str,
    email: str,
    password: str,
    staff_name: str,
    staff_type: str,
    check_code: int,
    is_lock: bool,
    is_company_admin: bool,
    can_manage_users: bool,
    default_warehouse: Warehouse | None = None,
) -> ProvisionedMembershipResult:
    if default_warehouse is not None and default_warehouse.openid != company.openid:
        raise ValidationError({"default_warehouse": "Default warehouse must belong to the selected company"})

    user_model = get_user_model()
    if user_model.objects.filter(username=username).exists():
        raise ValidationError({"username": "A browser account with this username already exists"})
    if user_model.objects.filter(email__iexact=email).exists():
        raise ValidationError({"email": "A browser account with this email already exists"})

    auth_user = user_model.objects.create_user(username=username, password=password, email=email)
    profile = Users.objects.create(
        user_id=auth_user.id,
        name=staff_name,
        vip=1,
        openid=generate_profile_token(company_openid=company.openid, username=username),
        appid=Md5.md5(f"{username}-appid"),
        developer=False,
        t_code=Md5.md5(f"{username}-{company.openid}-membership"),
        ip="",
    )
    staff = Staff.objects.create(
        staff_name=staff_name,
        staff_type=staff_type,
        check_code=check_code,
        openid=company.openid,
        is_lock=is_lock,
    )
    membership = CompanyMembership.objects.create(
        company=company,
        auth_user=auth_user,
        profile=profile,
        staff=staff,
        default_warehouse=default_warehouse,
        is_company_admin=is_company_admin or role_grants_company_admin(staff_type),
        can_manage_users=can_manage_users or is_company_admin or role_grants_company_admin(staff_type),
        is_active=True,
        invited_by=operator_name,
        creator=operator_name,
        openid=company.openid,
    )
    append_access_audit_event(
        company=company,
        operator_name=operator_name,
        membership=membership,
        action_type=AccessAuditAction.MEMBERSHIP_PROVISIONED,
        target_identifier=username,
        payload={"staff_type": staff_type, "default_warehouse": default_warehouse.id if default_warehouse else None},
    )
    return ProvisionedMembershipResult(
        auth_user=auth_user,
        profile=profile,
        staff=staff,
        company=company,
        membership=membership,
    )


@transaction.atomic
def update_company_membership(
    *,
    membership: CompanyMembership,
    operator_name: str,
    email: str,
    staff_name: str,
    staff_type: str,
    check_code: int,
    is_lock: bool,
    is_company_admin: bool,
    can_manage_users: bool,
    is_active: bool,
    default_warehouse: Warehouse | None = None,
    password: str = "",
) -> CompanyMembership:
    if default_warehouse is not None and default_warehouse.openid != membership.company.openid:
        raise ValidationError({"default_warehouse": "Default warehouse must belong to the membership company"})
    if email and get_user_model().objects.exclude(id=membership.auth_user_id).filter(email__iexact=email).exists():
        raise ValidationError({"email": "A browser account with this email already exists"})

    auth_user = membership.auth_user
    if email != auth_user.email:
        auth_user.email = email
        auth_user.save(update_fields=["email"])
    if password:
        auth_user.set_password(password)
        auth_user.save(update_fields=["password"])

    profile = membership.profile
    if profile.name != staff_name:
        profile.name = staff_name
        profile.save(update_fields=["name", "update_time"])

    staff = membership.staff
    staff.staff_name = staff_name
    staff.staff_type = staff_type
    staff.check_code = check_code
    staff.is_lock = is_lock
    staff.save(update_fields=["staff_name", "staff_type", "check_code", "is_lock", "update_time"])

    membership.default_warehouse = default_warehouse
    membership.is_company_admin = is_company_admin or role_grants_company_admin(staff_type)
    membership.can_manage_users = can_manage_users or membership.is_company_admin or role_grants_company_admin(staff_type)
    membership.is_active = is_active
    membership.creator = membership.creator or operator_name
    membership.save(
        update_fields=[
            "default_warehouse",
            "is_company_admin",
            "can_manage_users",
            "is_active",
            "update_time",
        ]
    )
    append_access_audit_event(
        company=membership.company,
        operator_name=operator_name,
        membership=membership,
        action_type=AccessAuditAction.MEMBERSHIP_UPDATED,
        target_identifier=membership.auth_user.username,
        payload={
            "staff_type": staff_type,
            "is_active": is_active,
            "is_lock": is_lock,
            "default_warehouse": default_warehouse.id if default_warehouse else None,
            "password_reset": bool(password),
        },
    )
    return membership


def _invite_is_expired(invite: CompanyInvite) -> bool:
    return invite.status == CompanyInviteStatus.PENDING and invite.expires_at <= timezone.now()


def _password_reset_is_expired(reset: CompanyPasswordReset) -> bool:
    return reset.status == CompanyPasswordResetStatus.PENDING and reset.expires_at <= timezone.now()


@transaction.atomic
def create_company_invite(
    *,
    company: Company,
    operator_name: str,
    payload: CompanyInviteCreatePayload,
) -> CompanyInvite:
    if payload.default_warehouse is not None and payload.default_warehouse.openid != company.openid:
        raise ValidationError({"default_warehouse": "Default warehouse must belong to the selected company"})
    if get_user_model().objects.filter(email__iexact=payload.email).exists():
        raise ValidationError({"email": "A browser account with this email already exists"})

    invite = CompanyInvite.objects.create(
        company=company,
        email=payload.email,
        staff_name=payload.staff_name,
        staff_type=payload.staff_type,
        check_code=payload.check_code,
        default_warehouse=payload.default_warehouse,
        is_company_admin=payload.is_company_admin or role_grants_company_admin(payload.staff_type),
        can_manage_users=payload.can_manage_users or payload.is_company_admin or role_grants_company_admin(payload.staff_type),
        invite_token=generate_invite_token(),
        invite_message=payload.invite_message,
        invited_by=operator_name,
        expires_at=timezone.now() + timedelta(days=payload.expires_in_days),
        creator=operator_name,
        openid=company.openid,
    )
    append_access_audit_event(
        company=company,
        operator_name=operator_name,
        invite=invite,
        action_type=AccessAuditAction.INVITE_CREATED,
        target_identifier=invite.email,
        payload={"staff_type": invite.staff_type, "expires_at": invite.expires_at.isoformat()},
    )
    return invite


@transaction.atomic
def revoke_company_invite(*, invite: CompanyInvite, operator_name: str) -> CompanyInvite:
    if invite.status != CompanyInviteStatus.PENDING:
        raise ValidationError({"detail": "Only pending invites can be revoked"})
    invite.status = CompanyInviteStatus.REVOKED
    invite.revoked_at = timezone.now()
    invite.save(update_fields=["status", "revoked_at", "update_time"])
    append_access_audit_event(
        company=invite.company,
        operator_name=operator_name,
        invite=invite,
        action_type=AccessAuditAction.INVITE_REVOKED,
        target_identifier=invite.email,
    )
    return invite


@transaction.atomic
def accept_company_invite(*, payload: CompanyInviteAcceptPayload) -> dict[str, object]:
    from userlogin.services import build_auth_response_data, resolve_workspace_identity

    invite = (
        CompanyInvite.objects.select_for_update(of=("self",))
        .select_related("company", "default_warehouse")
        .filter(invite_token=payload.invite_token, is_delete=False)
        .first()
    )
    if invite is None:
        raise ValidationError({"invite_token": "Invite token was not found"})
    if _invite_is_expired(invite):
        invite.status = CompanyInviteStatus.EXPIRED
        invite.save(update_fields=["status", "update_time"])
        raise ValidationError({"invite_token": "Invite token has expired"})
    if invite.status != CompanyInviteStatus.PENDING:
        raise ValidationError({"invite_token": "Invite token is no longer active"})

    result = provision_company_user(
        company=invite.company,
        operator_name=invite.staff_name,
        username=payload.username,
        email=invite.email,
        password=payload.password,
        staff_name=invite.staff_name,
        staff_type=invite.staff_type,
        check_code=invite.check_code,
        is_lock=False,
        is_company_admin=invite.is_company_admin,
        can_manage_users=invite.can_manage_users,
        default_warehouse=invite.default_warehouse,
    )
    invite.status = CompanyInviteStatus.ACCEPTED
    invite.accepted_at = timezone.now()
    invite.accepted_membership = result.membership
    invite.save(update_fields=["status", "accepted_at", "accepted_membership", "update_time"])
    append_access_audit_event(
        company=invite.company,
        operator_name=result.staff.staff_name,
        invite=invite,
        membership=result.membership,
        action_type=AccessAuditAction.INVITE_ACCEPTED,
        target_identifier=result.auth_user.username,
        payload={"email": invite.email},
    )
    identity = resolve_workspace_identity(auth_user=result.auth_user, profile_token=result.profile.openid)
    return build_auth_response_data(identity=identity, mfa_enrollment_required=True)


@transaction.atomic
def issue_company_password_reset(
    *,
    operator_name: str,
    payload: CompanyPasswordResetCreatePayload,
) -> CompanyPasswordReset:
    membership = payload.membership
    CompanyPasswordReset.objects.filter(
        membership=membership,
        status=CompanyPasswordResetStatus.PENDING,
        is_delete=False,
    ).update(
        status=CompanyPasswordResetStatus.REVOKED,
        revoked_at=timezone.now(),
        update_time=timezone.now(),
    )
    reset = CompanyPasswordReset.objects.create(
        company=membership.company,
        membership=membership,
        reset_token=generate_password_reset_token(),
        issued_by=operator_name,
        expires_at=timezone.now() + timedelta(hours=payload.expires_in_hours),
        notes=payload.notes,
        creator=operator_name,
        openid=membership.company.openid,
    )
    append_access_audit_event(
        company=membership.company,
        operator_name=operator_name,
        membership=membership,
        password_reset=reset,
        action_type=AccessAuditAction.PASSWORD_RESET_ISSUED,
        target_identifier=membership.auth_user.username,
        payload={"expires_at": reset.expires_at.isoformat()},
    )
    return reset


@transaction.atomic
def revoke_company_password_reset(*, password_reset: CompanyPasswordReset, operator_name: str) -> CompanyPasswordReset:
    if password_reset.status != CompanyPasswordResetStatus.PENDING:
        raise ValidationError({"detail": "Only pending password resets can be revoked"})
    password_reset.status = CompanyPasswordResetStatus.REVOKED
    password_reset.revoked_at = timezone.now()
    password_reset.save(update_fields=["status", "revoked_at", "update_time"])
    append_access_audit_event(
        company=password_reset.company,
        operator_name=operator_name,
        membership=password_reset.membership,
        password_reset=password_reset,
        action_type=AccessAuditAction.PASSWORD_RESET_REVOKED,
        target_identifier=password_reset.membership.auth_user.username,
    )
    return password_reset


@transaction.atomic
def complete_company_password_reset(*, payload: CompanyPasswordResetCompletePayload) -> CompanyPasswordReset:
    password_reset = (
        CompanyPasswordReset.objects.select_for_update()
        .select_related("company", "membership", "membership__auth_user")
        .filter(reset_token=payload.reset_token, is_delete=False)
        .first()
    )
    if password_reset is None:
        raise ValidationError({"reset_token": "Reset token was not found"})
    if _password_reset_is_expired(password_reset):
        password_reset.status = CompanyPasswordResetStatus.EXPIRED
        password_reset.save(update_fields=["status", "update_time"])
        raise ValidationError({"reset_token": "Reset token has expired"})
    if password_reset.status != CompanyPasswordResetStatus.PENDING:
        raise ValidationError({"reset_token": "Reset token is no longer active"})

    auth_user = password_reset.membership.auth_user
    auth_user.set_password(payload.password)
    auth_user.save(update_fields=["password"])
    password_reset.status = CompanyPasswordResetStatus.COMPLETED
    password_reset.completed_at = timezone.now()
    password_reset.save(update_fields=["status", "completed_at", "update_time"])
    append_access_audit_event(
        company=password_reset.company,
        operator_name=password_reset.membership.staff.staff_name,
        membership=password_reset.membership,
        password_reset=password_reset,
        action_type=AccessAuditAction.PASSWORD_RESET_COMPLETED,
        target_identifier=auth_user.username,
    )
    return password_reset


@transaction.atomic
def sync_workspace_tab(
    *,
    membership: CompanyMembership,
    operator_name: str,
    payload: WorkspaceTabSyncPayload,
) -> WorkspaceTabPreference:
    tab, created = WorkspaceTabPreference.objects.get_or_create(
        membership=membership,
        route_path=payload.route_path,
        is_delete=False,
        defaults={
            "route_key": payload.route_key,
            "title": payload.title,
            "icon_key": payload.icon_key,
            "position": WorkspaceTabPreference.objects.filter(membership=membership, is_delete=False).count(),
            "is_active": payload.is_active,
            "is_pinned": payload.is_pinned,
            "state_payload": payload.state_payload,
            "context_payload": payload.context_payload,
            "creator": operator_name,
            "openid": membership.company.openid,
        },
    )
    if payload.is_active:
        WorkspaceTabPreference.objects.filter(membership=membership, is_delete=False).exclude(id=tab.id).update(is_active=False)
    if not created:
        tab.route_key = payload.route_key
        tab.title = payload.title
        tab.icon_key = payload.icon_key
        tab.is_active = payload.is_active
        tab.is_pinned = payload.is_pinned
        tab.state_payload = payload.state_payload
        tab.context_payload = payload.context_payload
        tab.save(
            update_fields=[
                "route_key",
                "title",
                "icon_key",
                "is_active",
                "is_pinned",
                "state_payload",
                "context_payload",
                "last_opened_at",
                "update_time",
            ]
        )
    return tab


@transaction.atomic
def activate_workspace_tab(*, tab: WorkspaceTabPreference) -> WorkspaceTabPreference:
    WorkspaceTabPreference.objects.filter(membership=tab.membership, is_delete=False).exclude(id=tab.id).update(is_active=False)
    tab.is_active = True
    tab.save(update_fields=["is_active", "last_opened_at", "update_time"])
    return tab


@transaction.atomic
def close_workspace_tab(*, tab: WorkspaceTabPreference) -> None:
    was_active = tab.is_active
    membership = tab.membership
    tab.is_delete = True
    tab.is_active = False
    tab.save(update_fields=["is_delete", "is_active", "update_time"])
    remaining_tabs = list(WorkspaceTabPreference.objects.filter(membership=membership, is_delete=False).order_by("position", "id"))
    for index, remaining_tab in enumerate(remaining_tabs):
        if remaining_tab.position != index:
            remaining_tab.position = index
            remaining_tab.save(update_fields=["position", "update_time"])
    if was_active and remaining_tabs:
        activate_workspace_tab(tab=remaining_tabs[0])


@transaction.atomic
def upsert_workbench_preference(
    *,
    membership: CompanyMembership,
    operator_name: str,
    payload: WorkbenchPreferencePayload,
) -> WorkbenchPreference:
    preference, _ = WorkbenchPreference.objects.get_or_create(
        membership=membership,
        page_key=payload.page_key,
        is_delete=False,
        defaults={
            "creator": operator_name,
            "openid": membership.company.openid,
        },
    )
    update_fields: list[str] = []
    if payload.time_window is not None and preference.time_window != payload.time_window:
        preference.time_window = payload.time_window
        update_fields.append("time_window")
    if payload.visible_widget_keys is not None and preference.visible_widget_keys != payload.visible_widget_keys:
        preference.visible_widget_keys = payload.visible_widget_keys
        update_fields.append("visible_widget_keys")
    if payload.right_rail_widget_keys is not None and preference.right_rail_widget_keys != payload.right_rail_widget_keys:
        preference.right_rail_widget_keys = payload.right_rail_widget_keys
        update_fields.append("right_rail_widget_keys")
    if payload.layout_payload is not None and preference.layout_payload != payload.layout_payload:
        preference.layout_payload = payload.layout_payload
        update_fields.append("layout_payload")
    if update_fields:
        preference.creator = preference.creator or operator_name
        update_fields.extend(["creator", "update_time"])
        preference.save(update_fields=update_fields)
    return preference
