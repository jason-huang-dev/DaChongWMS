from __future__ import annotations

from typing import Any


class APIException(Exception):
    status_code: int
    default_detail: Any
    default_code: str

    def __init__(self, detail: Any = ..., code: Any = ...) -> None: ...


class AuthenticationFailed(APIException):
    pass


class PermissionDenied(APIException):
    pass


class ValidationError(APIException):
    pass
