"""Serializers for company context, invites, resets, and access audit APIs."""

from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework import serializers

from warehouse.models import Warehouse

from .models import (
    AccessAuditEvent,
    CompanyInvite,
    CompanyMembership,
    CompanyPasswordReset,
    QueueViewPreference,
    WorkspaceTabPreference,
    WorkbenchPreference,
    WorkbenchTimeWindow,
)


class MyCompanyMembershipSerializer(serializers.ModelSerializer[CompanyMembership]):
    company_id = serializers.IntegerField(source="company.id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    company_code = serializers.CharField(source="company.company_code", read_only=True)
    company_openid = serializers.CharField(source="company.openid", read_only=True)
    company_description = serializers.CharField(source="company.description", read_only=True)
    staff_id = serializers.IntegerField(source="staff.id", read_only=True)
    staff_name = serializers.CharField(source="staff.staff_name", read_only=True)
    staff_type = serializers.CharField(source="staff.staff_type", read_only=True)
    username = serializers.CharField(source="auth_user.username", read_only=True)
    email = serializers.EmailField(source="auth_user.email", read_only=True)
    profile_token = serializers.CharField(source="profile.openid", read_only=True)
    default_warehouse_name = serializers.CharField(source="default_warehouse.warehouse_name", read_only=True)
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = CompanyMembership
        fields = [
            "id",
            "company_id",
            "company_name",
            "company_code",
            "company_openid",
            "company_description",
            "staff_id",
            "staff_name",
            "staff_type",
            "username",
            "email",
            "profile_token",
            "default_warehouse",
            "default_warehouse_name",
            "is_company_admin",
            "can_manage_users",
            "is_active",
            "last_selected_at",
            "is_current",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields

    def get_is_current(self, obj: CompanyMembership) -> bool:
        current_membership_id = self.context.get("current_membership_id")
        return current_membership_id == obj.id


class CompanyMembershipSerializer(serializers.ModelSerializer[CompanyMembership]):
    company_id = serializers.IntegerField(source="company.id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    staff_id = serializers.IntegerField(source="staff.id", read_only=True)
    username = serializers.CharField(source="auth_user.username", read_only=True)
    email = serializers.EmailField(source="auth_user.email", read_only=True)
    staff_name = serializers.CharField(source="staff.staff_name", read_only=True)
    staff_type = serializers.CharField(source="staff.staff_type", read_only=True)
    check_code = serializers.IntegerField(source="staff.check_code", read_only=True)
    is_lock = serializers.BooleanField(source="staff.is_lock", read_only=True)
    profile_token = serializers.CharField(source="profile.openid", read_only=True)
    default_warehouse_name = serializers.CharField(source="default_warehouse.warehouse_name", read_only=True)

    class Meta:
        model = CompanyMembership
        fields = [
            "id",
            "company_id",
            "company_name",
            "username",
            "email",
            "staff_id",
            "staff_name",
            "staff_type",
            "check_code",
            "is_lock",
            "profile_token",
            "default_warehouse",
            "default_warehouse_name",
            "is_company_admin",
            "can_manage_users",
            "is_active",
            "invited_by",
            "last_selected_at",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class CompanyMembershipProvisionSerializer(serializers.Serializer[dict[str, object]]):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    staff_name = serializers.CharField(max_length=80)
    staff_type = serializers.CharField(max_length=255)
    check_code = serializers.IntegerField(min_value=0, max_value=999999)
    is_lock = serializers.BooleanField(required=False, default=False)
    is_company_admin = serializers.BooleanField(required=False, default=False)
    can_manage_users = serializers.BooleanField(required=False, default=False)
    default_warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False), allow_null=True, required=False)

    def validate_email(self, value: str) -> str:
        try:
            validate_email(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(" ".join(exc.messages))
        return value.lower()

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(" ".join(exc.messages))
        return value


class CompanyMembershipUpdateSerializer(serializers.Serializer[dict[str, object]]):
    email = serializers.EmailField()
    staff_name = serializers.CharField(max_length=80)
    staff_type = serializers.CharField(max_length=255)
    check_code = serializers.IntegerField(min_value=0, max_value=999999)
    is_lock = serializers.BooleanField(required=False, default=False)
    is_company_admin = serializers.BooleanField(required=False, default=False)
    can_manage_users = serializers.BooleanField(required=False, default=False)
    is_active = serializers.BooleanField(required=False, default=True)
    default_warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False), allow_null=True, required=False)
    password = serializers.CharField(write_only=True, trim_whitespace=False, allow_blank=True, required=False, default="")

    def validate_email(self, value: str) -> str:
        try:
            validate_email(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(" ".join(exc.messages))
        return value.lower()

    def validate_password(self, value: str) -> str:
        if not value:
            return value
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(" ".join(exc.messages))
        return value


class CompanyInviteSerializer(serializers.ModelSerializer[CompanyInvite]):
    company_id = serializers.IntegerField(source="company.id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    default_warehouse_name = serializers.CharField(source="default_warehouse.warehouse_name", read_only=True)
    accepted_membership_id = serializers.IntegerField(source="accepted_membership.id", read_only=True)
    accepted_username = serializers.CharField(source="accepted_membership.auth_user.username", read_only=True)

    class Meta:
        model = CompanyInvite
        fields = [
            "id",
            "company_id",
            "company_name",
            "email",
            "staff_name",
            "staff_type",
            "check_code",
            "default_warehouse",
            "default_warehouse_name",
            "is_company_admin",
            "can_manage_users",
            "status",
            "invite_token",
            "invite_message",
            "invited_by",
            "expires_at",
            "accepted_at",
            "revoked_at",
            "accepted_membership_id",
            "accepted_username",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class CompanyInviteCreateSerializer(serializers.Serializer[dict[str, object]]):
    email = serializers.EmailField()
    staff_name = serializers.CharField(max_length=80)
    staff_type = serializers.CharField(max_length=255)
    check_code = serializers.IntegerField(min_value=0, max_value=999999)
    default_warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False), allow_null=True, required=False)
    is_company_admin = serializers.BooleanField(required=False, default=False)
    can_manage_users = serializers.BooleanField(required=False, default=False)
    invite_message = serializers.CharField(allow_blank=True, required=False, default="")
    expires_in_days = serializers.IntegerField(min_value=1, max_value=30, required=False, default=7)

    def validate_email(self, value: str) -> str:
        try:
            validate_email(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(" ".join(exc.messages))
        return value.lower()


class CompanyInviteAcceptSerializer(serializers.Serializer[dict[str, object]]):
    invite_token = serializers.CharField(max_length=128)
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(" ".join(exc.messages))
        return value


class CompanyPasswordResetSerializer(serializers.ModelSerializer[CompanyPasswordReset]):
    company_id = serializers.IntegerField(source="company.id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    membership_id = serializers.IntegerField(source="membership.id", read_only=True)
    username = serializers.CharField(source="membership.auth_user.username", read_only=True)
    email = serializers.EmailField(source="membership.auth_user.email", read_only=True)
    staff_name = serializers.CharField(source="membership.staff.staff_name", read_only=True)
    staff_type = serializers.CharField(source="membership.staff.staff_type", read_only=True)

    class Meta:
        model = CompanyPasswordReset
        fields = [
            "id",
            "company_id",
            "company_name",
            "membership_id",
            "username",
            "email",
            "staff_name",
            "staff_type",
            "reset_token",
            "status",
            "issued_by",
            "expires_at",
            "completed_at",
            "revoked_at",
            "notes",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class CompanyPasswordResetCreateSerializer(serializers.Serializer[dict[str, object]]):
    membership = serializers.PrimaryKeyRelatedField(queryset=CompanyMembership.objects.filter(is_delete=False))
    expires_in_hours = serializers.IntegerField(min_value=1, max_value=168, required=False, default=24)
    notes = serializers.CharField(allow_blank=True, required=False, default="")


class CompanyPasswordResetCompleteSerializer(serializers.Serializer[dict[str, object]]):
    reset_token = serializers.CharField(max_length=128)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_password(self, value: str) -> str:
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(" ".join(exc.messages))
        return value


class AccessAuditEventSerializer(serializers.ModelSerializer[AccessAuditEvent]):
    company_id = serializers.IntegerField(source="company.id", read_only=True)
    company_name = serializers.CharField(source="company.company_name", read_only=True)
    membership_id = serializers.IntegerField(source="membership.id", read_only=True)
    username = serializers.CharField(source="membership.auth_user.username", read_only=True)
    invite_email = serializers.EmailField(source="invite.email", read_only=True)
    password_reset_username = serializers.CharField(source="password_reset.membership.auth_user.username", read_only=True)

    class Meta:
        model = AccessAuditEvent
        fields = [
            "id",
            "company_id",
            "company_name",
            "membership_id",
            "username",
            "invite",
            "invite_email",
            "password_reset",
            "password_reset_username",
            "action_type",
            "actor_name",
            "target_identifier",
            "payload",
            "occurred_at",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class QueueViewPreferenceSerializer(serializers.ModelSerializer[QueueViewPreference]):
    membership_id = serializers.IntegerField(source="membership.id", read_only=True)
    company_id = serializers.IntegerField(source="membership.company.id", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)

    class Meta:
        model = QueueViewPreference
        fields = [
            "id",
            "membership_id",
            "company_id",
            "warehouse",
            "warehouse_name",
            "route_key",
            "name",
            "search_scope",
            "status_bucket",
            "filter_payload",
            "sort_payload",
            "visible_columns",
            "page_size",
            "density",
            "is_default",
            "last_used_at",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["id", "membership_id", "company_id", "warehouse_name", "create_time", "update_time"]


class QueueViewPreferenceWriteSerializer(serializers.ModelSerializer[QueueViewPreference]):
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False), allow_null=True, required=False)

    class Meta:
        model = QueueViewPreference
        fields = [
            "warehouse",
            "route_key",
            "name",
            "search_scope",
            "status_bucket",
            "filter_payload",
            "sort_payload",
            "visible_columns",
            "page_size",
            "density",
            "is_default",
        ]


class WorkspaceTabPreferenceSerializer(serializers.ModelSerializer[WorkspaceTabPreference]):
    membership_id = serializers.IntegerField(source="membership.id", read_only=True)

    class Meta:
        model = WorkspaceTabPreference
        fields = [
            "id",
            "membership_id",
            "route_key",
            "route_path",
            "title",
            "icon_key",
            "position",
            "is_active",
            "is_pinned",
            "state_payload",
            "context_payload",
            "last_opened_at",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["id", "membership_id", "last_opened_at", "create_time", "update_time"]


class WorkspaceTabSyncSerializer(serializers.Serializer[dict[str, object]]):
    route_key = serializers.CharField(max_length=128)
    route_path = serializers.CharField(max_length=255)
    title = serializers.CharField(max_length=120)
    icon_key = serializers.CharField(max_length=64, allow_blank=True, required=False, default="")
    is_active = serializers.BooleanField(required=False, default=True)
    is_pinned = serializers.BooleanField(required=False, default=False)
    state_payload = serializers.JSONField(required=False, default=dict)
    context_payload = serializers.JSONField(required=False, default=dict)


class WorkbenchPreferenceSerializer(serializers.ModelSerializer[WorkbenchPreference]):
    membership_id = serializers.IntegerField(source="membership.id", read_only=True)

    class Meta:
        model = WorkbenchPreference
        fields = [
            "id",
            "membership_id",
            "page_key",
            "time_window",
            "visible_widget_keys",
            "right_rail_widget_keys",
            "layout_payload",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["id", "membership_id", "create_time", "update_time"]


class WorkbenchPreferenceWriteSerializer(serializers.Serializer[dict[str, object]]):
    page_key = serializers.CharField(max_length=128, required=False, default="dashboard")
    time_window = serializers.ChoiceField(choices=WorkbenchTimeWindow.choices, required=False)
    visible_widget_keys = serializers.ListField(child=serializers.CharField(max_length=64), required=False)
    right_rail_widget_keys = serializers.ListField(child=serializers.CharField(max_length=64), required=False)
    layout_payload = serializers.JSONField(required=False)
