"""Session login endpoint that mirrors the legacy GreaterWMS behavior."""

from __future__ import annotations

import json
from typing import Any, Dict

from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate, login as auth_login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from mfa.services import create_login_challenge, has_verified_enrollment
from userlogin.services import build_auth_response_data, register_workspace_user, resolve_workspace_identity
from userprofile.models import Users
from utils.fbmsg import FBMsg


def _client_ip(request: HttpRequest) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _parse_body(request: HttpRequest) -> Dict[str, Any]:
    try:
        return json.loads(request.body.decode() or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


@csrf_exempt
def login(request: HttpRequest, *args: Any, **kwargs: Any) -> JsonResponse:
    if request.method != "POST":
        response = FBMsg.err_ret()
        response["msg"] = "Only POST is allowed"
        return JsonResponse(response, status=405)

    payload = _parse_body(request)
    username = str(payload.get("name") or "").strip()
    password = str(payload.get("password") or "")
    ip = _client_ip(request)

    if not username or not password:
        response = FBMsg.err_ret()
        response["ip"] = ip
        response["data"] = {"name": username}
        response["msg"] = "User name and password are required"
        return JsonResponse(response, status=400)

    user = authenticate(request, username=username, password=password)
    if user is None:
        response = FBMsg.err_ret()
        response["ip"] = ip
        response["data"] = {"name": username}
        return JsonResponse(response, status=401)

    try:
        identity = resolve_workspace_identity(auth_user=user)
    except ValueError as exc:
        response = FBMsg.err_ret()
        response["ip"] = ip
        response["msg"] = str(exc)
        return JsonResponse(response, status=400)

    mfa_enrollment_required = not has_verified_enrollment(auth_user=user, openid=identity.profile.openid)
    if not mfa_enrollment_required:
        challenge = create_login_challenge(identity=identity, ip=ip or "")
        response = FBMsg.ret()
        response["ip"] = ip
        response["msg"] = "MFA challenge required"
        response["data"] = {
            "name": username,
            "mfa_required": True,
            "challenge_id": str(challenge.challenge_id),
            "available_methods": ["totp", "recovery_code"],
            "expires_at": challenge.expires_at.isoformat(),
        }
        return JsonResponse(response, status=202)

    auth_login(request, user)
    response = FBMsg.ret()
    response["ip"] = ip
    response["data"] = build_auth_response_data(
        identity=identity,
        mfa_enrollment_required=mfa_enrollment_required,
    )
    return JsonResponse(response)


@csrf_exempt
def register(request: HttpRequest, *args: Any, **kwargs: Any) -> JsonResponse:
    if request.method != "POST":
        response = FBMsg.err_ret()
        response["msg"] = "Only POST is allowed"
        return JsonResponse(response, status=405)

    payload = _parse_body(request)
    username = str(payload.get("name") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    password1 = str(payload.get("password1") or "")
    password2 = str(payload.get("password2") or "")
    ip = _client_ip(request)

    if not username:
        response = FBMsg.err_user_name()
        response["ip"] = ip
        return JsonResponse(response, status=400)

    if not email:
        response = FBMsg.err_data()
        response["ip"] = ip
        response["msg"] = "Email is required"
        response["data"] = {"name": username}
        return JsonResponse(response, status=400)

    try:
        validate_email(email)
    except DjangoValidationError:
        response = FBMsg.err_data()
        response["ip"] = ip
        response["msg"] = "Email is invalid"
        response["data"] = {"name": username, "email": email}
        return JsonResponse(response, status=400)

    if not password1:
        response = FBMsg.err_password1_empty()
        response["ip"] = ip
        response["data"] = {"name": username, "email": email}
        return JsonResponse(response, status=400)

    if not password2:
        response = FBMsg.err_password2_empty()
        response["ip"] = ip
        response["data"] = {"name": username, "email": email}
        return JsonResponse(response, status=400)

    if password1 != password2:
        response = FBMsg.err_password_not_same()
        response["ip"] = ip
        response["data"] = {"name": username, "email": email}
        return JsonResponse(response, status=400)

    user_model = get_user_model()
    if user_model.objects.filter(username=username).exists() or Users.objects.filter(name=username, is_delete=False).exists():
        response = FBMsg.err_user_same()
        response["ip"] = ip
        response["data"] = username
        return JsonResponse(response, status=409)

    if user_model.objects.filter(email__iexact=email).exists():
        response = FBMsg.err_code1()
        response["ip"] = ip
        response["msg"] = "Email is already registered"
        response["data"] = {"name": username, "email": email}
        return JsonResponse(response, status=409)

    try:
        validate_password(password1)
    except DjangoValidationError as exc:
        response = FBMsg.err_data()
        response["ip"] = ip
        response["msg"] = " ".join(exc.messages)
        response["data"] = {"name": username, "email": email}
        return JsonResponse(response, status=400)

    result = register_workspace_user(username=username, password=password1, email=email, ip=ip or "")
    auth_login(request, result.auth_user, backend="django.contrib.auth.backends.ModelBackend")
    identity = resolve_workspace_identity(auth_user=result.auth_user)

    response = FBMsg.ret()
    response["ip"] = ip
    response["data"] = build_auth_response_data(
        identity=identity,
        mfa_enrollment_required=True,
        extra={"email": email},
    )
    return JsonResponse(response, status=201)
