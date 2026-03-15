"""Endpoints for MFA enrollment and challenge verification."""

from __future__ import annotations

import json
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from utils.fbmsg import FBMsg
from utils.operator import get_request_operator
from userlogin.services import build_auth_response_data, resolve_workspace_identity

from .permissions import CanManageOwnMFA
from .serializers import MFAChallengeVerifySerializer, TOTPEnrollmentCreateSerializer, TOTPEnrollmentVerifySerializer
from .services import (
    MFAServiceError,
    build_mfa_status,
    issue_totp_enrollment,
    verify_login_challenge,
    verify_totp_enrollment,
)


def _client_ip(request: HttpRequest) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def _parse_body(request: HttpRequest) -> dict[str, object]:
    try:
        return json.loads(request.body.decode() or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return {}


def _get_authenticated_auth_user(request: Request):
    auth_user_id = getattr(request.auth, "user_id", None)
    if not isinstance(auth_user_id, int):
        raise APIException({"detail": "Authenticated tenant context is incomplete"})
    auth_user = get_user_model().objects.filter(id=auth_user_id).first()
    if auth_user is None:
        raise APIException({"detail": "Authenticated user not found"})
    return auth_user


class MFAStatusView(APIView):
    permission_classes = [CanManageOwnMFA]

    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        get_request_operator(request)
        openid = getattr(request.auth, "openid", None)
        if not isinstance(openid, str) or not openid:
            raise APIException({"detail": "Authenticated tenant context is incomplete"})
        auth_user = _get_authenticated_auth_user(request)
        return Response(build_mfa_status(auth_user=auth_user, openid=openid), status=status.HTTP_200_OK)


class TOTPEnrollmentCreateView(APIView):
    permission_classes = [CanManageOwnMFA]

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = TOTPEnrollmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        identity = resolve_workspace_identity(auth_user=_get_authenticated_auth_user(request))
        setup = issue_totp_enrollment(
            auth_user=identity.auth_user,
            openid=identity.profile.openid,
            creator=operator.staff_name,
            email=getattr(identity.auth_user, "email", ""),
            label=serializer.validated_data.get("label", "Authenticator app"),
        )
        return Response(
            {
                "enrollment_id": setup.enrollment.id,
                "label": setup.enrollment.label,
                "method": setup.enrollment.method,
                "secret": setup.secret,
                "provisioning_uri": setup.provisioning_uri,
                "issuer": settings.MFA_ISSUER,
                "recovery_codes_remaining": setup.recovery_codes_remaining,
            },
            status=status.HTTP_201_CREATED,
        )


class TOTPEnrollmentVerifyView(APIView):
    permission_classes = [CanManageOwnMFA]

    def post(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = TOTPEnrollmentVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        enrollment = serializer.validated_data["enrollment_id"]
        openid = getattr(request.auth, "openid", None)
        if enrollment.openid != openid:
            raise APIException({"detail": "Enrollment does not belong to the authenticated tenant"})
        try:
            result = verify_totp_enrollment(enrollment=enrollment, code=serializer.validated_data["code"], creator=operator.staff_name)
        except MFAServiceError as exc:
            detail = exc.message_dict if hasattr(exc, "message_dict") else {"detail": " ".join(exc.messages)}
            raise ValidationError(detail)
        return Response(
            {
                "enrollment_id": result.enrollment.id,
                "verified": result.enrollment.is_verified,
                "verified_at": result.enrollment.verified_at,
                "recovery_codes": list(result.recovery_codes),
            },
            status=status.HTTP_200_OK,
        )


@csrf_exempt
def verify_challenge(request: HttpRequest, *args: Any, **kwargs: Any) -> JsonResponse:
    if request.method != "POST":
        response = FBMsg.err_ret()
        response["msg"] = "Only POST is allowed"
        return JsonResponse(response, status=405)

    serializer = MFAChallengeVerifySerializer(data=_parse_body(request))
    if not serializer.is_valid():
        response = FBMsg.err_data()
        response["msg"] = " ".join(
            str(message)
            for messages in serializer.errors.values()
            for message in (messages if isinstance(messages, list) else [messages])
        )
        return JsonResponse(response, status=400)
    try:
        result = verify_login_challenge(
            challenge_id=serializer.validated_data["challenge_id"],
            code=serializer.validated_data["code"],
            ip=_client_ip(request),
        )
    except MFAServiceError as exc:
        response = FBMsg.err_data()
        response["msg"] = " ".join(exc.messages) if hasattr(exc, "messages") else str(exc)
        return JsonResponse(response, status=400)

    response = FBMsg.ret()
    identity = resolve_workspace_identity(auth_user=result.auth_user)
    response["data"] = build_auth_response_data(
        identity=identity,
        mfa_enrollment_required=False,
        extra={"mfa_verified": True, "mfa_method": result.verified_method},
    )
    response["ip"] = _client_ip(request)
    return JsonResponse(response, status=200)
