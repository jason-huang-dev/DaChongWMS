from django_filters import rest_framework as filters

from .models import AutomationAlert, BackgroundTask, ScheduledTask, WorkerHeartbeat


class ScheduledTaskFilter(filters.FilterSet):
    class Meta:
        model = ScheduledTask
        fields = {
            "warehouse": ["exact"],
            "customer": ["exact"],
            "task_type": ["exact"],
            "is_active": ["exact"],
        }


class BackgroundTaskFilter(filters.FilterSet):
    class Meta:
        model = BackgroundTask
        fields = {
            "warehouse": ["exact"],
            "customer": ["exact"],
            "scheduled_task": ["exact"],
            "integration_job": ["exact"],
            "report_export": ["exact"],
            "invoice": ["exact"],
            "task_type": ["exact"],
            "status": ["exact"],
            "reference_code": ["exact", "icontains"],
        }


class WorkerHeartbeatFilter(filters.FilterSet):
    class Meta:
        model = WorkerHeartbeat
        fields = {
            "worker_name": ["exact", "icontains"],
            "last_seen_at": ["exact", "gte", "lte"],
        }


class AutomationAlertFilter(filters.FilterSet):
    class Meta:
        model = AutomationAlert
        fields = {
            "warehouse": ["exact", "isnull"],
            "scheduled_task": ["exact", "isnull"],
            "background_task": ["exact", "isnull"],
            "alert_type": ["exact"],
            "severity": ["exact"],
            "status": ["exact"],
            "alert_key": ["exact", "icontains"],
            "opened_at": ["exact", "gte", "lte"],
            "resolved_at": ["exact", "gte", "lte", "isnull"],
        }
