from __future__ import annotations

from typing import Any


class PageNumberPagination:
    page_size: int | None
    page_size_query_param: str | None
    max_page_size: int | None
    page_query_param: str | None

    def paginate_queryset(self, queryset: Any, request: Any, view: Any = ...) -> list[Any] | None: ...

    def get_paginated_response(self, data: Any) -> Any: ...
