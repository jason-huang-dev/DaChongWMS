"""Session login endpoint that mirrors the legacy GreaterWMS behavior."""

from __future__ import annotations

import json
from typing import Any, Dict

from django.contrib.auth import authenticate, login as auth_login
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from staff.models import ListModel as Staff
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

    user_profile = Users.objects.filter(user_id=user.id).first()
    if user_profile is None:
        response = FBMsg.err_ret()
        response["ip"] = ip
        response["msg"] = "User profile not found"
        return JsonResponse(response, status=400)

    staff_entry = Staff.objects.filter(
        openid=user_profile.openid,
        staff_name=user_profile.name,
        is_delete=False,
    ).first()
    if staff_entry is None:
        response = FBMsg.err_ret()
        response["ip"] = ip
        response["msg"] = "Staff record not found"
        return JsonResponse(response, status=400)

    auth_login(request, user)
    data = {
        "name": username,
        "openid": user_profile.openid,
        "user_id": staff_entry.id,
    }
    response = FBMsg.ret()
    response["ip"] = ip
    response["data"] = data
    return JsonResponse(response)
