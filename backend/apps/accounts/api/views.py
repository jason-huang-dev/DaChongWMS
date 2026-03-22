from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsActiveAuthenticated
from apps.accounts.serializers import CurrentUserSerializer


class CurrentUserAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request) -> Response:
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)
