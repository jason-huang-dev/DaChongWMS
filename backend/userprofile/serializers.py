"""Basic serializers for the user profile app."""

from rest_framework import serializers

from .models import Users


class UsersSerializer(serializers.ModelSerializer):
    class Meta:
        model = Users
        fields = [
            "id",
            "user_id",
            "name",
            "vip",
            "openid",
            "appid",
            "developer",
            "link_to",
            "link_to_id",
            "avatar",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["id", "create_time", "update_time"]
