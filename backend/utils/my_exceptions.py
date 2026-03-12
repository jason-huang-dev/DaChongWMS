"""Custom DRF exception handler used by the legacy stack."""

from __future__ import annotations

from typing import Any, Mapping

from django.db import DatabaseError
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc: Exception, context: Mapping[str, Any]) -> Response | None:
    response = exception_handler(exc, dict(context))
    if response is not None:
        data = dict(response.data)
        data["status_code"] = response.status_code
        return Response(data, status=response.status_code)
    if isinstance(exc, DatabaseError):
        return Response({"detail": "Database Error"}, status=500)
    return Response({"detail": "Unhandled Error"}, status=500)
