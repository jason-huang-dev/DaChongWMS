from __future__ import annotations

from typing import Any

from .views import APIView


class GenericAPIView(APIView):
    queryset: Any
    serializer_class: Any

    def get_queryset(self) -> Any: ...

    def get_serializer(self, *args: Any, **kwargs: Any) -> Any: ...

    def get_serializer_class(self) -> Any: ...


class ListCreateAPIView(GenericAPIView):
    pass


class RetrieveUpdateAPIView(GenericAPIView):
    pass
