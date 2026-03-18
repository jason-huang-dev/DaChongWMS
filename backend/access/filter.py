from django_filters import FilterSet

from .models import (
    AccessAuditEvent,
    CompanyInvite,
    CompanyMembership,
    CompanyPasswordReset,
    QueueViewPreference,
    WorkspaceTabPreference,
    WorkbenchPreference,
)


class CompanyMembershipFilter(FilterSet):
    class Meta:
        model = CompanyMembership
        fields = {
            "company": ["exact"],
            "auth_user__username": ["exact", "icontains"],
            "auth_user__email": ["exact", "icontains"],
            "staff__staff_type": ["exact"],
            "staff__is_lock": ["exact"],
            "is_company_admin": ["exact"],
            "can_manage_users": ["exact"],
            "is_active": ["exact"],
            "default_warehouse": ["exact", "isnull"],
            "last_selected_at": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class CompanyInviteFilter(FilterSet):
    class Meta:
        model = CompanyInvite
        fields = {
            "company": ["exact"],
            "email": ["exact", "icontains"],
            "staff_type": ["exact"],
            "status": ["exact"],
            "is_company_admin": ["exact"],
            "can_manage_users": ["exact"],
            "default_warehouse": ["exact", "isnull"],
            "expires_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "accepted_at": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class CompanyPasswordResetFilter(FilterSet):
    class Meta:
        model = CompanyPasswordReset
        fields = {
            "company": ["exact"],
            "membership": ["exact"],
            "membership__auth_user__username": ["exact", "icontains"],
            "status": ["exact"],
            "expires_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "completed_at": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class AccessAuditEventFilter(FilterSet):
    class Meta:
        model = AccessAuditEvent
        fields = {
            "company": ["exact"],
            "membership": ["exact", "isnull"],
            "invite": ["exact", "isnull"],
            "password_reset": ["exact", "isnull"],
            "action_type": ["exact"],
            "actor_name": ["exact", "icontains"],
            "target_identifier": ["exact", "icontains"],
            "occurred_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class QueueViewPreferenceFilter(FilterSet):
    class Meta:
        model = QueueViewPreference
        fields = {
            "route_key": ["exact", "icontains"],
            "name": ["exact", "icontains"],
            "warehouse": ["exact", "isnull"],
            "search_scope": ["exact"],
            "status_bucket": ["exact"],
            "density": ["exact"],
            "is_default": ["exact"],
            "last_used_at": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class WorkspaceTabPreferenceFilter(FilterSet):
    class Meta:
        model = WorkspaceTabPreference
        fields = {
            "route_key": ["exact", "icontains"],
            "route_path": ["exact", "icontains"],
            "is_active": ["exact"],
            "is_pinned": ["exact"],
            "position": ["exact", "range"],
            "last_opened_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class WorkbenchPreferenceFilter(FilterSet):
    class Meta:
        model = WorkbenchPreference
        fields = {
            "page_key": ["exact", "icontains"],
            "time_window": ["exact"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }
