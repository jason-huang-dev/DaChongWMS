"""REST API endpoints for managing staff and staff roles."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, Sequence, Type

from django.http import StreamingHttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.filters import OrderingFilter
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ModelSerializer
from rest_framework.settings import api_settings

from utils.page import MyPageNumberPagination

from .files import FileRenderCN, FileRenderEN
from .filter import StaffFilter, StaffTypeFilter
from .models import ListModel, TypeListModel
from .serializers import (
    FileRenderSerializer,
    StaffGetSerializer,
    StaffPartialUpdateSerializer,
    StaffPostSerializer,
    StaffTypeGetSerializer,
    StaffUpdateSerializer,
)

FilterBackend = Type[Any]


class StaffViewSet(viewsets.ModelViewSet):
    """Full CRUD endpoints for staff records tied to the authenticated openid."""

    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[FilterBackend] = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    filterset_class = StaffFilter

    def get_queryset(self):
        openid = getattr(self.request.auth, "openid", None)
        base = ListModel.objects.filter(openid=openid, is_delete=False)
        pk = self.kwargs.get("pk")
        if pk is None:
            return base
        return base.filter(id=pk)

    def get_serializer_class(self) -> Type[ModelSerializer]:
        action_map: Dict[str, Type[ModelSerializer]] = {
            "list": StaffGetSerializer,
            "retrieve": StaffGetSerializer,
            "destroy": StaffGetSerializer,
            "create": StaffPostSerializer,
            "update": StaffUpdateSerializer,
            "partial_update": StaffPartialUpdateSerializer,
        }
        return action_map.get(self.action, StaffGetSerializer)

    def list(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        staff_name = request.query_params.get("staff_name")
        check_code = request.query_params.get("check_code")
        if staff_name is None or check_code is None:
            return super().list(request, *args, **kwargs)
        record = ListModel.objects.filter(
            openid=getattr(request.auth, "openid", None),
            staff_name=staff_name,
            is_delete=False,
        ).first()
        if record is None:
            raise ValidationError({"detail": "The user name does not exist"})
        if record.is_lock:
            raise ValidationError({"detail": "The user has been locked. Please contact the administrator"})
        if record.error_check_code_counter == 3:
            record.is_lock = True
            record.error_check_code_counter = 0
            record.save(update_fields=["is_lock", "error_check_code_counter", "update_time"])
            raise ValidationError({"detail": "The user has been locked. Please contact the administrator"})
        try:
            provided_code = int(check_code)
        except (TypeError, ValueError):
            raise ValidationError({"detail": "The verification code is incorrect"})
        if record.check_code != provided_code:
            record.error_check_code_counter = int(record.error_check_code_counter) + 1
            record.save(update_fields=["error_check_code_counter", "update_time"])
            raise ValidationError({"detail": "The verification code is incorrect"})
        record.error_check_code_counter = 0
        record.save(update_fields=["error_check_code_counter", "update_time"])
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer: StaffPostSerializer) -> None:
        openid = getattr(self.request.auth, "openid", None)
        staff_name = serializer.validated_data.get("staff_name")
        if ListModel.objects.filter(openid=openid, staff_name=staff_name, is_delete=False).exists():
            raise ValidationError({"detail": "Data exists"})
        serializer.save(openid=openid)

    def perform_destroy(self, instance: ListModel) -> None:
        instance.is_delete = True
        instance.save(update_fields=["is_delete", "update_time"])


class StaffTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """Expose the static staff role metadata."""

    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[FilterBackend] = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    filterset_class = StaffTypeFilter
    serializer_class = StaffTypeGetSerializer

    def get_queryset(self):
        return TypeListModel.objects.filter(openid="init_data")


class StaffFileDownloadView(viewsets.ReadOnlyModelViewSet):
    """Stream staff data as CSV in either English or Chinese."""

    renderer_classes = (FileRenderCN,) + tuple(api_settings.DEFAULT_RENDERER_CLASSES)
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[FilterBackend] = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    filterset_class = StaffFilter
    serializer_class = FileRenderSerializer

    def get_queryset(self):
        openid = getattr(self.request.auth, "openid", None)
        base = ListModel.objects.filter(openid=openid, is_delete=False)
        pk = self.kwargs.get("pk")
        if pk is None:
            return base
        return base.filter(id=pk)

    def list(self, request: Request, *args: Any, **kwargs: Any) -> StreamingHttpResponse:
        instances = self.filter_queryset(self.get_queryset())
        data: Iterable[Dict[str, Any]] = (FileRenderSerializer(instance).data for instance in instances)
        renderer = self._select_renderer(request.META.get("HTTP_LANGUAGE"))
        response = StreamingHttpResponse(
            renderer.render(data),
            content_type="text/csv",
        )
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        response["Content-Disposition"] = f"attachment; filename='staff_{timestamp}.csv'"
        return response

    def _select_renderer(self, language_header: str | None):
        if language_header and language_header.lower() == "zh-hans":
            return FileRenderCN()
        return FileRenderEN()
