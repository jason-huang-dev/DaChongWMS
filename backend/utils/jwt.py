"""JWT helpers for service-to-service authentication."""

from __future__ import annotations

import datetime
from typing import Any, Dict

import jwt
from jwt import exceptions
from django.conf import settings

JWT_SALT = getattr(settings, "DJANGO_JWT_SALT", "dachongwms-default-jwt-salt")


def create_token(payload: Dict[str, Any]) -> str:
    headers = {"type": "jwt", "alg": "HS256"}
    expires_in = getattr(settings, "JWT_TIME", 60 * 60 * 24)
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    payload = {**payload, "exp": now_utc + datetime.timedelta(seconds=expires_in)}
    return jwt.encode(payload=payload, key=JWT_SALT, algorithm="HS256", headers=headers)


def parse_payload(token: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {"status": False, "data": None, "error": None}
    try:
        verified = jwt.decode(token, JWT_SALT, algorithms=["HS256"], options={"verify_signature": True})
        result.update({"status": True, "data": verified})
    except exceptions.ExpiredSignatureError:
        result["error"] = "Token expired"
    except jwt.DecodeError:
        result["error"] = "Token authentication failed"
    except jwt.InvalidTokenError:
        result["error"] = "Illegal token"
    return result
