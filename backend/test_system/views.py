"""Test-system bootstrap endpoint.

This mirrors the useful part of the legacy ``userregister`` module: create a
tenant-scoped user plus a deterministic set of demo records that exercise the
current backend apps.
"""

from __future__ import annotations

import json
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from test_system.services import (
    DEFAULT_BOOTSTRAP_PASSWORD,
    DEFAULT_BOOTSTRAP_USERNAME,
    bootstrap_test_system,
    ensure_media_directories,
)
from userprofile.models import Users
from utils.fbmsg import FBMsg


def _client_ip(request: HttpRequest) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _parse_body(request: HttpRequest) -> dict[str, Any]:
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode() or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("Request body must be valid JSON") from exc


def _bootstrap_enabled() -> bool:
    return bool(getattr(settings, "TEST_SYSTEM_ENABLED", settings.DEBUG))


@csrf_exempt
def register(request: HttpRequest, *args: Any, **kwargs: Any) -> JsonResponse:
    if request.method != "POST":
        response = FBMsg.err_ret()
        response["msg"] = "Only POST is allowed"
        return JsonResponse(response, status=405)

    if not _bootstrap_enabled():
        response = FBMsg.err_data()
        response["msg"] = "Test-system bootstrap is disabled"
        return JsonResponse(response, status=403)

    try:
        payload = _parse_body(request)
    except ValueError as exc:
        response = FBMsg.err_data()
        response["msg"] = str(exc)
        return JsonResponse(response, status=400)

    ip = _client_ip(request)
    username = str(payload.get("name") or DEFAULT_BOOTSTRAP_USERNAME).strip()
    password1 = str(payload.get("password1") or DEFAULT_BOOTSTRAP_PASSWORD)
    password2 = str(payload.get("password2") or password1)

    if not username:
        response = FBMsg.err_user_name()
        response["ip"] = ip
        return JsonResponse(response, status=400)

    user_model = get_user_model()
    if user_model.objects.filter(username=username).exists() or Users.objects.filter(
        name=username,
        developer=True,
        is_delete=False,
    ).exists():
        response = FBMsg.err_user_same()
        response["ip"] = ip
        response["data"] = username
        return JsonResponse(response, status=409)

    if password1 != password2:
        response = FBMsg.err_password_not_same()
        response["ip"] = ip
        response["data"] = username
        return JsonResponse(response, status=400)

    result = bootstrap_test_system(username=username, password=password1, ip=ip)
    ensure_media_directories(result.profile.openid)
    response = FBMsg.ret()
    response["ip"] = ip
    response["data"] = {
        "name": username,
        "openid": result.profile.openid,
        "user_id": result.admin_staff.id,
        "used_default_name": username == DEFAULT_BOOTSTRAP_USERNAME and "name" not in payload,
        "used_default_password": "password1" not in payload and "password2" not in payload,
        "seed_summary": result.seed_summary,
    }
    return JsonResponse(response, status=201)
