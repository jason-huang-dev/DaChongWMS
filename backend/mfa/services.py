"""Service helpers for MFA enrollment and challenge verification."""

from __future__ import annotations

import base64
import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Sequence

from cryptography.fernet import Fernet
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
import pyotp

from userlogin.services import WorkspaceIdentity

from .models import MFAChallenge, MFAEnrollment, MFARecoveryCode


@dataclass(frozen=True)
class EnrollmentSetup:
    enrollment: MFAEnrollment
    secret: str
    provisioning_uri: str
    recovery_codes_remaining: int


@dataclass(frozen=True)
class EnrollmentVerificationResult:
    enrollment: MFAEnrollment
    recovery_codes: Sequence[str]


@dataclass(frozen=True)
class ChallengeVerificationResult:
    challenge: MFAChallenge
    auth_user: object
    openid: str
    operator_id: int
    operator_name: str
    username: str
    verified_method: str


class MFAServiceError(ValidationError):
    pass


def _fernet() -> Fernet:
    material = getattr(settings, "MFA_ENCRYPTION_KEY", settings.SECRET_KEY)
    digest = hashlib.sha256(str(material).encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode("utf-8")).decode("utf-8")


def decrypt_secret(encrypted_secret: str) -> str:
    return _fernet().decrypt(encrypted_secret.encode("utf-8")).decode("utf-8")


def normalize_code(code: str) -> str:
    return "".join(character for character in code.strip() if character.isalnum()).upper()


def has_verified_enrollment(*, auth_user=None, openid: str | None = None) -> bool:
    queryset = MFAEnrollment.objects.filter(is_delete=False, is_verified=True)
    if auth_user is not None:
        queryset = queryset.filter(user=auth_user)
    if openid:
        queryset = queryset.filter(openid=openid)
    return queryset.exists()


def build_mfa_status(*, auth_user, openid: str) -> dict[str, object]:
    enrollments = MFAEnrollment.objects.filter(user=auth_user, openid=openid, is_delete=False).order_by("-is_primary", "-create_time")
    primary = enrollments.first()
    verified_enrollments = enrollments.filter(is_verified=True)
    recovery_codes_remaining = MFARecoveryCode.objects.filter(
        enrollment__in=verified_enrollments,
        openid=openid,
        used_at__isnull=True,
        is_delete=False,
    ).count()
    return {
        "has_verified_enrollment": verified_enrollments.exists(),
        "enrollment_required": not verified_enrollments.exists(),
        "primary_enrollment": None
        if primary is None
        else {
            "id": primary.id,
            "label": primary.label,
            "method": primary.method,
            "is_verified": primary.is_verified,
            "is_primary": primary.is_primary,
            "verified_at": primary.verified_at,
            "create_time": primary.create_time,
        },
        "recovery_codes_remaining": recovery_codes_remaining,
        "verified_methods": [item.method for item in verified_enrollments],
    }


@transaction.atomic
def issue_totp_enrollment(*, auth_user, openid: str, creator: str, email: str, label: str = "Authenticator app") -> EnrollmentSetup:
    MFAEnrollment.objects.filter(user=auth_user, openid=openid, is_verified=False, is_delete=False).update(is_delete=True)
    secret = pyotp.random_base32()
    enrollment = MFAEnrollment.objects.create(
        user=auth_user,
        openid=openid,
        label=label or "Authenticator app",
        method=MFAEnrollment.Method.TOTP,
        encrypted_secret=encrypt_secret(secret),
        is_primary=not MFAEnrollment.objects.filter(user=auth_user, openid=openid, is_delete=False).exists(),
        creator=creator,
    )
    account_name = email or getattr(auth_user, "username", "")
    provisioning_uri = pyotp.TOTP(secret).provisioning_uri(name=account_name, issuer_name=getattr(settings, "MFA_ISSUER", "DaChongWMS"))
    return EnrollmentSetup(
        enrollment=enrollment,
        secret=secret,
        provisioning_uri=provisioning_uri,
        recovery_codes_remaining=0,
    )


@transaction.atomic
def verify_totp_enrollment(*, enrollment: MFAEnrollment, code: str, creator: str) -> EnrollmentVerificationResult:
    normalized_code = normalize_code(code)
    secret = decrypt_secret(enrollment.encrypted_secret)
    if not pyotp.TOTP(secret).verify(normalized_code, valid_window=1):
        raise MFAServiceError({"code": "Invalid MFA verification code"})

    now = timezone.now()
    enrollment.is_verified = True
    enrollment.is_primary = True
    enrollment.verified_at = now
    enrollment.last_used_at = now
    enrollment.creator = creator
    enrollment.save(update_fields=["is_verified", "is_primary", "verified_at", "last_used_at", "creator", "update_time"])
    MFAEnrollment.objects.filter(user=enrollment.user, openid=enrollment.openid, is_delete=False).exclude(id=enrollment.id).update(is_primary=False)

    enrollment.recovery_codes.filter(is_delete=False).update(is_delete=True)
    recovery_codes = []
    recovery_code_count = int(getattr(settings, "MFA_RECOVERY_CODE_COUNT", 8))
    for _ in range(recovery_code_count):
        plain_code = f"{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}-{secrets.token_hex(2).upper()}"
        recovery_codes.append(plain_code)
        MFARecoveryCode.objects.create(
            enrollment=enrollment,
            openid=enrollment.openid,
            code_hash=make_password(normalize_code(plain_code)),
            code_hint=plain_code[-4:],
            creator=creator,
        )

    return EnrollmentVerificationResult(enrollment=enrollment, recovery_codes=recovery_codes)


@transaction.atomic
def create_login_challenge(*, identity: WorkspaceIdentity, ip: str) -> MFAChallenge:
    now = timezone.now()
    MFAChallenge.objects.filter(
        user=identity.auth_user,
        openid=identity.company.openid,
        status=MFAChallenge.Status.PENDING,
        is_delete=False,
    ).update(status=MFAChallenge.Status.EXPIRED)
    return MFAChallenge.objects.create(
        user=identity.auth_user,
        openid=identity.company.openid,
        username=getattr(identity.auth_user, "username", identity.profile.name),
        operator_id=identity.staff.id,
        operator_name=identity.staff.staff_name,
        status=MFAChallenge.Status.PENDING,
        expires_at=now + timedelta(seconds=int(getattr(settings, "MFA_CHALLENGE_TTL_SECONDS", 300))),
        ip=ip,
        creator=identity.staff.staff_name,
    )


@transaction.atomic
def verify_login_challenge(*, challenge_id, code: str, ip: str = "") -> ChallengeVerificationResult:
    challenge = MFAChallenge.objects.select_for_update().filter(challenge_id=challenge_id, is_delete=False).first()
    if challenge is None:
        raise MFAServiceError({"challenge_id": "Challenge does not exist"})

    now = timezone.now()
    if challenge.status != MFAChallenge.Status.PENDING:
        raise MFAServiceError({"challenge_id": "Challenge is no longer pending"})
    if challenge.expires_at <= now:
        challenge.status = MFAChallenge.Status.EXPIRED
        challenge.save(update_fields=["status", "update_time"])
        raise MFAServiceError({"challenge_id": "Challenge has expired"})

    enrollment = MFAEnrollment.objects.filter(
        user=challenge.user,
        openid=challenge.openid,
        is_delete=False,
        is_verified=True,
    ).order_by("-is_primary", "-verified_at").first()
    if enrollment is None:
        raise MFAServiceError({"detail": "No verified MFA enrollment found"})

    normalized_code = normalize_code(code)
    verified_method = ""
    secret = decrypt_secret(enrollment.encrypted_secret)
    if pyotp.TOTP(secret).verify(normalized_code, valid_window=1):
        verified_method = MFAChallenge.Method.TOTP
    else:
        recovery_code = next(
            (
                item
                for item in enrollment.recovery_codes.filter(is_delete=False, used_at__isnull=True)
                if check_password(normalized_code, item.code_hash)
            ),
            None,
        )
        if recovery_code is None:
            raise MFAServiceError({"code": "Invalid MFA code"})
        verified_method = MFAChallenge.Method.RECOVERY_CODE
        recovery_code.used_at = now
        recovery_code.save(update_fields=["used_at", "update_time"])

    challenge.status = MFAChallenge.Status.USED
    challenge.verified_method = verified_method
    challenge.verified_at = now
    challenge.consumed_at = now
    challenge.ip = ip or challenge.ip
    challenge.save(update_fields=["status", "verified_method", "verified_at", "consumed_at", "ip", "update_time"])
    enrollment.last_used_at = now
    enrollment.save(update_fields=["last_used_at", "update_time"])

    return ChallengeVerificationResult(
        challenge=challenge,
        auth_user=challenge.user,
        openid=challenge.openid,
        operator_id=challenge.operator_id,
        operator_name=challenge.operator_name,
        username=challenge.username,
        verified_method=verified_method,
    )
