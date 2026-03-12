"""User profile endpoints (placeholder)."""

from rest_framework import viewsets
from rest_framework.permissions import IsAdminUser

from .models import Users
from .serializers import UsersSerializer


class UsersViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Users.objects.all()
    serializer_class = UsersSerializer
    permission_classes = [IsAdminUser]
