from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import User
from apps.accounts.services.session_service import (
    build_authenticated_response,
    can_manage_users,
    get_membership_staff_profile,
)
from apps.iam.models import PermissionOverride, Role, RoleAssignment
from apps.iam.role_assignment_policy import (
    can_assign_role,
    role_management_flags,
    sync_role_assignment_policies,
)
from apps.organizations.models import (
    MembershipType,
    Organization,
    OrganizationAccessAuditAction,
    OrganizationAccessAuditEvent,
    OrganizationInvite,
    OrganizationInviteStatus,
    OrganizationMembership,
    OrganizationPasswordReset,
    OrganizationPasswordResetStatus,
    OrganizationStaffProfile,
)


@dataclass(frozen=True, slots=True)
class StaffDirectoryInput:
    organization: Organization
    actor_membership: OrganizationMembership
    staff_name: str
    staff_type: str
    check_code: int
    is_lock: bool


@dataclass(frozen=True, slots=True)
class MembershipAdminInput:
    organization: Organization
    actor_membership: OrganizationMembership
    username: str
    email: str
    password: str
    staff_name: str
    staff_type: str
    check_code: int
    is_lock: bool
    is_company_admin: bool
    can_manage_users: bool
    is_active: bool
    default_warehouse_id: int | None


@dataclass(frozen=True, slots=True)
class InviteCreateInput:
    organization: Organization
    actor_membership: OrganizationMembership
    email: str
    staff_name: str
    staff_type: str
    check_code: int
    default_warehouse_id: int | None
    is_company_admin: bool
    can_manage_users: bool
    invite_message: str
    expires_in_days: int


@dataclass(frozen=True, slots=True)
class PasswordResetCreateInput:
    organization: Organization
    actor_membership: OrganizationMembership
    membership: OrganizationMembership
    expires_in_hours: int
    notes: str


@dataclass(frozen=True, slots=True)
class InviteAcceptanceInput:
    invite_token: str
    username: str
    password: str


@dataclass(frozen=True, slots=True)
class PasswordResetCompletionInput:
    reset_token: str
    password: str


def _normalize_email(email: str) -> str:
    return User.objects.normalize_email(email).strip().lower()


def _normalize_username(username: str) -> str:
    return username.strip()


def _normalize_staff_name(staff_name: str) -> str:
    return staff_name.strip()


def _normalize_staff_type(staff_type: str) -> str:
    return staff_type.strip()


def _resolve_membership_type_for_staff_type(staff_type: str) -> str:
    normalized = _normalize_staff_type(staff_type)
    if normalized.upper() in {Role.SystemCode.CLIENT_ADMIN, Role.SystemCode.CLIENT_USER}:
        return MembershipType.CLIENT
    if normalized.lower() in {"client admin", "client user"}:
        return MembershipType.CLIENT
    return MembershipType.INTERNAL


def _require_access_manager(actor_membership: OrganizationMembership) -> None:
    if not can_manage_users(actor_membership):
        raise PermissionDenied("Only organization access managers can perform this action.")


def _actor_name(actor_membership: OrganizationMembership) -> str:
    profile = get_membership_staff_profile(actor_membership)
    if profile is not None and profile.staff_name:
        return profile.staff_name
    return actor_membership.user.display_name


def _resolve_default_warehouse(
    *,
    organization: Organization,
    warehouse_id: int | None,
):
    if warehouse_id is None:
        return None
    from apps.warehouse.models import Warehouse

    warehouse = Warehouse.objects.filter(
        id=warehouse_id,
        organization=organization,
        is_active=True,
    ).first()
    if warehouse is None:
        raise ValidationError({"default_warehouse": "Default warehouse does not exist in this organization."})
    return warehouse


def _resolve_role_for_staff_type(
    *,
    organization: Organization,
    staff_type: str,
    membership_type: str,
) -> Role:
    sync_role_assignment_policies()
    normalized_staff_type = _normalize_staff_type(staff_type)
    role = (
        Role.objects.filter(
            Q(organization=organization) | Q(organization__isnull=True),
            is_active=True,
            membership_type=membership_type,
        )
        .filter(Q(code__iexact=normalized_staff_type) | Q(name__iexact=normalized_staff_type))
        .order_by("organization_id", "id")
        .first()
    )
    if role is None:
        raise ValidationError({"staff_type": "Selected role does not exist for this organization."})
    return role

def _clear_legacy_management_overrides(membership: OrganizationMembership) -> None:
    PermissionOverride.objects.filter(
        membership=membership,
        scope__isnull=True,
        permission__content_type__app_label="iam",
        permission__codename__in=("manage_memberships", "manage_client_users"),
    ).delete()


def _authorize_role_assignment(
    *,
    actor_membership: OrganizationMembership,
    role: Role,
) -> None:
    if can_assign_role(actor_membership, role):
        return
    raise PermissionDenied("You are not allowed to assign the selected role.")


def _append_audit_event(
    *,
    organization: Organization,
    actor_membership: OrganizationMembership | None,
    action_type: str,
    target_identifier: str,
    payload: dict[str, object] | None = None,
    invite: OrganizationInvite | None = None,
    password_reset: OrganizationPasswordReset | None = None,
    membership: OrganizationMembership | None = None,
) -> OrganizationAccessAuditEvent:
    return OrganizationAccessAuditEvent.objects.create(
        organization=organization,
        membership=membership,
        invite=invite,
        password_reset=password_reset,
        action_type=action_type,
        actor_name=_actor_name(actor_membership) if actor_membership is not None else "",
        target_identifier=target_identifier,
        payload=payload or {},
    )


def _resolve_or_create_user(
    *,
    username: str,
    email: str,
    password: str,
    staff_name: str,
) -> tuple[User, bool]:
    normalized_email = _normalize_email(email)
    normalized_username = _normalize_username(username)
    if User.objects.exclude(email=normalized_email).filter(username__iexact=normalized_username).exists():
        raise ValidationError({"username": "A browser account with this username already exists."})

    user = User.objects.filter(email=normalized_email).first()
    created = user is None
    if user is None:
        user = User.objects.create_user(
            email=normalized_email,
            password=password,
            full_name=_normalize_staff_name(staff_name),
            username=normalized_username,
        )
        return user, True

    updated_fields: list[str] = []
    if normalized_username and user.username != normalized_username:
        user.username = normalized_username
        updated_fields.append("username")
    if user.full_name != _normalize_staff_name(staff_name):
        user.full_name = _normalize_staff_name(staff_name)
        updated_fields.append("full_name")
    if password:
        user.set_password(password)
        updated_fields.append("password")
    if updated_fields:
        user.save(update_fields=updated_fields)
    return user, created


def _upsert_membership_staff_profile(
    *,
    membership: OrganizationMembership,
    staff_name: str,
    staff_type: str,
    check_code: int,
    is_lock: bool,
    default_warehouse_id: int | None,
) -> OrganizationStaffProfile:
    default_warehouse = _resolve_default_warehouse(
        organization=membership.organization,
        warehouse_id=default_warehouse_id,
    )
    profile, _ = OrganizationStaffProfile.objects.update_or_create(
        organization=membership.organization,
        membership=membership,
        defaults={
            "staff_name": _normalize_staff_name(staff_name),
            "staff_type": _normalize_staff_type(staff_type),
            "check_code": check_code,
            "is_lock": is_lock,
            "default_warehouse": default_warehouse,
        },
    )
    return profile


@transaction.atomic
def create_staff_directory_entry(payload: StaffDirectoryInput) -> OrganizationStaffProfile:
    _require_access_manager(payload.actor_membership)
    entry = OrganizationStaffProfile.objects.create(
        organization=payload.organization,
        membership=None,
        staff_name=_normalize_staff_name(payload.staff_name),
        staff_type=_normalize_staff_type(payload.staff_type),
        check_code=payload.check_code,
        is_lock=payload.is_lock,
    )
    _append_audit_event(
        organization=payload.organization,
        actor_membership=payload.actor_membership,
        action_type=OrganizationAccessAuditAction.STAFF_DIRECTORY_CREATED,
        target_identifier=entry.staff_name,
        payload={"staff_directory_entry_id": entry.id, "staff_type": entry.staff_type},
    )
    return entry


@transaction.atomic
def update_staff_directory_entry(
    *,
    actor_membership: OrganizationMembership,
    entry: OrganizationStaffProfile,
    payload: StaffDirectoryInput,
) -> OrganizationStaffProfile:
    _require_access_manager(actor_membership)
    if entry.organization_id != payload.organization.id:
        raise PermissionDenied("Staff directory rows can only be updated inside the active organization.")
    if entry.membership_id is not None:
        raise PermissionDenied("Browser-linked operator profiles are managed through company memberships.")

    entry.staff_name = _normalize_staff_name(payload.staff_name)
    entry.staff_type = _normalize_staff_type(payload.staff_type)
    entry.check_code = payload.check_code
    entry.is_lock = payload.is_lock
    entry.save(update_fields=["staff_name", "staff_type", "check_code", "is_lock", "update_time"])
    _append_audit_event(
        organization=payload.organization,
        actor_membership=actor_membership,
        action_type=OrganizationAccessAuditAction.STAFF_DIRECTORY_UPDATED,
        target_identifier=entry.staff_name,
        payload={"staff_directory_entry_id": entry.id, "staff_type": entry.staff_type},
    )
    return entry


@transaction.atomic
def create_company_membership(payload: MembershipAdminInput) -> OrganizationMembership:
    _require_access_manager(payload.actor_membership)
    membership_type = _resolve_membership_type_for_staff_type(payload.staff_type)
    user, _ = _resolve_or_create_user(
        username=payload.username,
        email=payload.email,
        password=payload.password,
        staff_name=payload.staff_name,
    )
    membership, created = OrganizationMembership.objects.get_or_create(
        user=user,
        organization=payload.organization,
        defaults={
            "membership_type": membership_type,
            "is_active": payload.is_active,
        },
    )
    if not created:
        membership.membership_type = membership_type
        membership.is_active = payload.is_active
        membership.save(update_fields=["membership_type", "is_active"])

    role = _resolve_role_for_staff_type(
        organization=payload.organization,
        staff_type=payload.staff_type,
        membership_type=membership.membership_type,
    )
    _authorize_role_assignment(actor_membership=payload.actor_membership, role=role)
    membership.role_assignments.filter(scope__isnull=True).delete()
    RoleAssignment.objects.get_or_create(membership=membership, role=role, scope=None)
    _clear_legacy_management_overrides(membership)
    _upsert_membership_staff_profile(
        membership=membership,
        staff_name=payload.staff_name,
        staff_type=role.name,
        check_code=payload.check_code,
        is_lock=payload.is_lock,
        default_warehouse_id=payload.default_warehouse_id,
    )
    _append_audit_event(
        organization=payload.organization,
        actor_membership=payload.actor_membership,
        action_type=OrganizationAccessAuditAction.MEMBERSHIP_CREATED,
        target_identifier=user.username or user.email,
        membership=membership,
        payload={"membership_id": membership.id, "role_code": role.code},
    )
    return membership


@transaction.atomic
def update_company_membership(
    *,
    actor_membership: OrganizationMembership,
    membership: OrganizationMembership,
    payload: MembershipAdminInput,
) -> OrganizationMembership:
    _require_access_manager(actor_membership)
    if membership.organization_id != payload.organization.id:
        raise PermissionDenied("Membership can only be updated inside the active organization.")

    user = membership.user
    normalized_username = _normalize_username(payload.username)
    normalized_email = _normalize_email(payload.email)
    if User.objects.exclude(id=user.id).filter(username__iexact=normalized_username).exists():
        raise ValidationError({"username": "A browser account with this username already exists."})
    if User.objects.exclude(id=user.id).filter(email__iexact=normalized_email).exists():
        raise ValidationError({"email": "A browser account with this email already exists."})

    user.email = normalized_email
    user.username = normalized_username
    user.full_name = _normalize_staff_name(payload.staff_name)
    if payload.password:
        user.set_password(payload.password)
        user.save(update_fields=["email", "username", "full_name", "password"])
    else:
        user.save(update_fields=["email", "username", "full_name"])

    role = _resolve_role_for_staff_type(
        organization=payload.organization,
        staff_type=payload.staff_type,
        membership_type=membership.membership_type,
    )
    _authorize_role_assignment(actor_membership=actor_membership, role=role)
    membership.is_active = payload.is_active
    membership.save(update_fields=["is_active"])
    membership.role_assignments.filter(scope__isnull=True).delete()
    RoleAssignment.objects.get_or_create(membership=membership, role=role, scope=None)
    _clear_legacy_management_overrides(membership)
    _upsert_membership_staff_profile(
        membership=membership,
        staff_name=payload.staff_name,
        staff_type=role.name,
        check_code=payload.check_code,
        is_lock=payload.is_lock,
        default_warehouse_id=payload.default_warehouse_id,
    )
    _append_audit_event(
        organization=payload.organization,
        actor_membership=actor_membership,
        action_type=OrganizationAccessAuditAction.MEMBERSHIP_UPDATED,
        target_identifier=user.username or user.email,
        membership=membership,
        payload={"membership_id": membership.id, "role_code": role.code},
    )
    return membership


@transaction.atomic
def create_invite(payload: InviteCreateInput) -> OrganizationInvite:
    _require_access_manager(payload.actor_membership)
    normalized_email = _normalize_email(payload.email)
    if User.objects.filter(email__iexact=normalized_email).exists():
        raise ValidationError({"email": "A browser account with this email already exists."})
    default_warehouse = _resolve_default_warehouse(
        organization=payload.organization,
        warehouse_id=payload.default_warehouse_id,
    )
    membership_type = _resolve_membership_type_for_staff_type(payload.staff_type)
    role = _resolve_role_for_staff_type(
        organization=payload.organization,
        staff_type=payload.staff_type,
        membership_type=membership_type,
    )
    _authorize_role_assignment(actor_membership=payload.actor_membership, role=role)
    is_company_admin, can_manage_member_users = role_management_flags(role)
    invite = OrganizationInvite.objects.create(
        organization=payload.organization,
        created_by_membership=payload.actor_membership,
        email=normalized_email,
        staff_name=_normalize_staff_name(payload.staff_name),
        staff_type=role.name,
        check_code=payload.check_code,
        default_warehouse=default_warehouse,
        is_company_admin=is_company_admin,
        can_manage_users=can_manage_member_users,
        invite_token=secrets.token_urlsafe(24),
        invite_message=payload.invite_message.strip(),
        invited_by=_actor_name(payload.actor_membership),
        expires_at=timezone.now() + timedelta(days=payload.expires_in_days),
    )
    _append_audit_event(
        organization=payload.organization,
        actor_membership=payload.actor_membership,
        action_type=OrganizationAccessAuditAction.INVITE_CREATED,
        target_identifier=invite.email,
        invite=invite,
        payload={"invite_id": invite.id, "staff_type": invite.staff_type},
    )
    return invite


@transaction.atomic
def revoke_invite(
    *,
    actor_membership: OrganizationMembership,
    invite: OrganizationInvite,
) -> OrganizationInvite:
    _require_access_manager(actor_membership)
    if invite.organization_id != actor_membership.organization_id:
        raise PermissionDenied("Invite can only be revoked inside the active organization.")
    invite.status = OrganizationInviteStatus.REVOKED
    invite.revoked_at = timezone.now()
    invite.save(update_fields=["status", "revoked_at", "update_time"])
    _append_audit_event(
        organization=invite.organization,
        actor_membership=actor_membership,
        action_type=OrganizationAccessAuditAction.INVITE_REVOKED,
        target_identifier=invite.email,
        invite=invite,
        payload={"invite_id": invite.id},
    )
    return invite


@transaction.atomic
def issue_password_reset(payload: PasswordResetCreateInput) -> OrganizationPasswordReset:
    _require_access_manager(payload.actor_membership)
    if payload.membership.organization_id != payload.organization.id:
        raise PermissionDenied("Password resets can only be issued inside the active organization.")
    OrganizationPasswordReset.objects.filter(
        membership=payload.membership,
        status=OrganizationPasswordResetStatus.PENDING,
    ).update(
        status=OrganizationPasswordResetStatus.REVOKED,
        revoked_at=timezone.now(),
        update_time=timezone.now(),
    )
    password_reset = OrganizationPasswordReset.objects.create(
        organization=payload.organization,
        membership=payload.membership,
        reset_token=secrets.token_urlsafe(24),
        issued_by=_actor_name(payload.actor_membership),
        expires_at=timezone.now() + timedelta(hours=payload.expires_in_hours),
        notes=payload.notes.strip(),
    )
    _append_audit_event(
        organization=payload.organization,
        actor_membership=payload.actor_membership,
        action_type=OrganizationAccessAuditAction.PASSWORD_RESET_ISSUED,
        target_identifier=payload.membership.user.username or payload.membership.user.email,
        password_reset=password_reset,
        payload={"password_reset_id": password_reset.id},
    )
    return password_reset


@transaction.atomic
def revoke_password_reset(
    *,
    actor_membership: OrganizationMembership,
    password_reset: OrganizationPasswordReset,
) -> OrganizationPasswordReset:
    _require_access_manager(actor_membership)
    if password_reset.organization_id != actor_membership.organization_id:
        raise PermissionDenied("Password reset can only be revoked inside the active organization.")
    password_reset.status = OrganizationPasswordResetStatus.REVOKED
    password_reset.revoked_at = timezone.now()
    password_reset.save(update_fields=["status", "revoked_at", "update_time"])
    _append_audit_event(
        organization=password_reset.organization,
        actor_membership=actor_membership,
        action_type=OrganizationAccessAuditAction.PASSWORD_RESET_REVOKED,
        target_identifier=password_reset.membership.user.username or password_reset.membership.user.email,
        password_reset=password_reset,
        payload={"password_reset_id": password_reset.id},
    )
    return password_reset


@transaction.atomic
def accept_invite(payload: InviteAcceptanceInput) -> dict[str, object]:
    invite = (
        OrganizationInvite.objects.select_for_update(of=("self",))
        .select_related("organization", "default_warehouse")
        .filter(invite_token=payload.invite_token.strip())
        .first()
    )
    if invite is None:
        raise ValidationError({"invite_token": "Invite token was not found"})

    resolved_status = resolve_invite_status(invite)
    if resolved_status == OrganizationInviteStatus.EXPIRED:
        if invite.status != OrganizationInviteStatus.EXPIRED:
            invite.status = OrganizationInviteStatus.EXPIRED
            invite.save(update_fields=["status", "update_time"])
        raise ValidationError({"invite_token": "Invite token has expired"})
    if invite.status != OrganizationInviteStatus.PENDING:
        raise ValidationError({"invite_token": "Invite token is no longer active"})

    membership_type = _resolve_membership_type_for_staff_type(invite.staff_type)
    user, _ = _resolve_or_create_user(
        username=payload.username,
        email=invite.email,
        password=payload.password,
        staff_name=invite.staff_name,
    )
    membership, created = OrganizationMembership.objects.get_or_create(
        user=user,
        organization=invite.organization,
        defaults={
            "membership_type": membership_type,
            "is_active": True,
        },
    )
    membership_updates: list[str] = []
    if not created and membership.membership_type != membership_type:
        membership.membership_type = membership_type
        membership_updates.append("membership_type")
    if not membership.is_active:
        membership.is_active = True
        membership_updates.append("is_active")
    if membership_updates:
        membership.save(update_fields=membership_updates)

    role = _resolve_role_for_staff_type(
        organization=invite.organization,
        staff_type=invite.staff_type,
        membership_type=membership.membership_type,
    )
    if invite.created_by_membership is not None:
        _authorize_role_assignment(actor_membership=invite.created_by_membership, role=role)
    else:
        is_company_admin, can_manage_member_users = role_management_flags(role)
        if is_company_admin or can_manage_member_users:
            raise PermissionDenied("Invite can no longer assign the selected role.")
    membership.role_assignments.filter(scope__isnull=True).delete()
    RoleAssignment.objects.get_or_create(membership=membership, role=role, scope=None)
    _clear_legacy_management_overrides(membership)
    _upsert_membership_staff_profile(
        membership=membership,
        staff_name=invite.staff_name,
        staff_type=role.name,
        check_code=invite.check_code,
        is_lock=False,
        default_warehouse_id=invite.default_warehouse_id,
    )
    invite.status = OrganizationInviteStatus.ACCEPTED
    invite.accepted_at = timezone.now()
    invite.accepted_membership = membership
    invite.save(update_fields=["status", "accepted_at", "accepted_membership", "update_time"])
    _append_audit_event(
        organization=invite.organization,
        actor_membership=membership,
        action_type=OrganizationAccessAuditAction.INVITE_ACCEPTED,
        target_identifier=user.username or user.email,
        invite=invite,
        membership=membership,
        payload={"invite_id": invite.id, "email": invite.email, "role_code": role.code},
    )
    return build_authenticated_response(
        membership=membership,
        extra={"mfa_enrollment_required": True},
    )


@transaction.atomic
def complete_password_reset(payload: PasswordResetCompletionInput) -> OrganizationPasswordReset:
    password_reset = (
        OrganizationPasswordReset.objects.select_for_update(of=("self",))
        .select_related(
            "organization",
            "membership",
            "membership__user",
            "membership__staff_profile",
        )
        .filter(reset_token=payload.reset_token.strip())
        .first()
    )
    if password_reset is None:
        raise ValidationError({"reset_token": "Reset token was not found"})

    resolved_status = resolve_password_reset_status(password_reset)
    if resolved_status == OrganizationPasswordResetStatus.EXPIRED:
        if password_reset.status != OrganizationPasswordResetStatus.EXPIRED:
            password_reset.status = OrganizationPasswordResetStatus.EXPIRED
            password_reset.save(update_fields=["status", "update_time"])
        raise ValidationError({"reset_token": "Reset token has expired"})
    if password_reset.status != OrganizationPasswordResetStatus.PENDING:
        raise ValidationError({"reset_token": "Reset token is no longer active"})

    user = password_reset.membership.user
    user.set_password(payload.password)
    user.save(update_fields=["password"])

    password_reset.status = OrganizationPasswordResetStatus.COMPLETED
    password_reset.completed_at = timezone.now()
    password_reset.save(update_fields=["status", "completed_at", "update_time"])
    _append_audit_event(
        organization=password_reset.organization,
        actor_membership=password_reset.membership,
        action_type=OrganizationAccessAuditAction.PASSWORD_RESET_COMPLETED,
        target_identifier=user.username or user.email,
        password_reset=password_reset,
        membership=password_reset.membership,
        payload={"password_reset_id": password_reset.id},
    )
    return password_reset


def resolve_invite_status(invite: OrganizationInvite) -> str:
    if invite.status == OrganizationInviteStatus.PENDING and invite.expires_at <= timezone.now():
        return OrganizationInviteStatus.EXPIRED
    return invite.status


def resolve_password_reset_status(password_reset: OrganizationPasswordReset) -> str:
    if password_reset.status == OrganizationPasswordResetStatus.PENDING and password_reset.expires_at <= timezone.now():
        return OrganizationPasswordResetStatus.EXPIRED
    return password_reset.status
