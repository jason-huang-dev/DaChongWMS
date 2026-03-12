from __future__ import annotations

from typing import Any, Callable, Mapping, Sequence, TypeVar


_Handler = TypeVar("_Handler", bound=Callable[..., Any])


class ViewSet:
    request: Any
    action: str
    kwargs: Mapping[str, Any]

    @classmethod
    def as_view(cls, actions: Mapping[str, str], **initkwargs: Any) -> Callable[..., Any]: ...


class GenericViewSet(ViewSet):
    queryset: Any
    serializer_class: Any


class ModelViewSet(GenericViewSet):
    filter_backends: Sequence[Any]
    ordering_fields: Sequence[str]
    filterset_class: Any
    pagination_class: Any

    def get_queryset(self) -> Any: ...

    def get_serializer_class(self) -> Any: ...

    def get_object(self) -> Any: ...

    def perform_create(self, serializer: Any) -> None: ...

    def perform_update(self, serializer: Any) -> None: ...

    def destroy(self, request: Any, *args: Any, **kwargs: Any) -> Any: ...


class ReadOnlyModelViewSet(ModelViewSet):
    pass
