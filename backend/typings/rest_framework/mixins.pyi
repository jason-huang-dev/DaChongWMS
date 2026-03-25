from __future__ import annotations

from typing import Any


class CreateModelMixin:
    def create(self, request: Any, *args: Any, **kwargs: Any) -> Any: ...


class RetrieveModelMixin:
    def retrieve(self, request: Any, *args: Any, **kwargs: Any) -> Any: ...


class UpdateModelMixin:
    def update(self, request: Any, *args: Any, **kwargs: Any) -> Any: ...

    def partial_update(self, request: Any, *args: Any, **kwargs: Any) -> Any: ...


class DestroyModelMixin:
    def destroy(self, request: Any, *args: Any, **kwargs: Any) -> Any: ...


class ListModelMixin:
    def list(self, request: Any, *args: Any, **kwargs: Any) -> Any: ...
