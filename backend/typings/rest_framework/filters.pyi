from __future__ import annotations

from typing import Any


class BaseFilterBackend:
    def filter_queryset(self, request: Any, queryset: Any, view: Any) -> Any: ...


class OrderingFilter(BaseFilterBackend):
    pass


class SearchFilter(BaseFilterBackend):
    pass
