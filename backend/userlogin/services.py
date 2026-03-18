"""Authentication-related service helpers."""

from __future__ import annotations

from dataclasses import dataclass

from django.contrib.auth import get_user_model
from django.db import transaction

from access.models import Company, CompanyMembership
from access.services import ensure_company_membership, get_preferred_membership_for_auth_user
from staff.models import ListModel as Staff
from userprofile.models import Users
from utils.md5 import Md5


@dataclass(frozen=True)
class RegistrationResult:
    auth_user: object
    profile: Users
    staff: Staff


@dataclass(frozen=True)
class WorkspaceIdentity:
    auth_user: object
    profile: Users
    staff: Staff
    company: Company
    membership: CompanyMembership


def resolve_workspace_identity(
    *,
    auth_user=None,
    username: str | None = None,
    company_openid: str | None = None,
    profile_token: str | None = None,
) -> WorkspaceIdentity:
    user_model = get_user_model()
    if auth_user is None:
        if not username:
            raise ValueError("username is required when auth_user is not provided")
        auth_user = user_model.objects.filter(username=username).first()
    if auth_user is None:
        raise ValueError("Authenticated user not found")

    membership = get_preferred_membership_for_auth_user(
        auth_user=auth_user,
        company_openid=company_openid,
        profile_token=profile_token,
    )
    if membership is None:
        profile = Users.objects.filter(user_id=auth_user.id, is_delete=False).first()
        if profile is None:
            raise ValueError("User profile not found")
        staff = Staff.objects.filter(
            openid=profile.openid,
            staff_name=profile.name,
            is_delete=False,
        ).first()
        if staff is None:
            raise ValueError("Staff record not found")
        membership = ensure_company_membership(
            auth_user=auth_user,
            profile=profile,
            staff=staff,
            creator=staff.staff_name,
        )
    return WorkspaceIdentity(
        auth_user=auth_user,
        profile=membership.profile,
        staff=membership.staff,
        company=membership.company,
        membership=membership,
    )


def build_auth_response_data(*, identity: WorkspaceIdentity, mfa_enrollment_required: bool, extra: dict[str, object] | None = None) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": getattr(identity.auth_user, "username", identity.profile.name),
        "openid": identity.company.openid,
        "token": identity.profile.openid,
        "user_id": identity.staff.id,
        "company_id": identity.company.id,
        "company_name": identity.company.company_name,
        "membership_id": identity.membership.id,
        "mfa_enrollment_required": mfa_enrollment_required,
    }
    if extra:
        payload.update(extra)
    return payload


@transaction.atomic
def register_workspace_user(*, username: str, password: str, email: str, ip: str) -> RegistrationResult:
    user_model = get_user_model()
    auth_user = user_model.objects.create_user(username=username, password=password, email=email)
    openid = Md5.md5(username)
    profile = Users.objects.create(
        user_id=auth_user.id,
        name=username,
        vip=1,
        openid=openid,
        appid=Md5.md5(f"{username}-appid"),
        developer=False,
        t_code=Md5.md5(f"{username}-t-code"),
        ip=ip,
    )
    staff = Staff.objects.create(
        staff_name=username,
        staff_type="Manager",
        check_code=8888,
        openid=openid,
    )
    ensure_company_membership(auth_user=auth_user, profile=profile, staff=staff, creator=staff.staff_name)
    return RegistrationResult(auth_user=auth_user, profile=profile, staff=staff)
