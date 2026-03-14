from django.contrib import admin

from .models import AutomationAlert, BackgroundTask, ScheduledTask, WorkerHeartbeat


@admin.register(ScheduledTask)
class ScheduledTaskAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "task_type", "warehouse", "customer", "next_run_at", "is_active")
    list_filter = ("task_type", "is_active")
    search_fields = ("name", "notes")


@admin.register(BackgroundTask)
class BackgroundTaskAdmin(admin.ModelAdmin):
    list_display = ("id", "task_type", "status", "reference_code", "available_at", "attempt_count", "locked_by")
    list_filter = ("task_type", "status")
    search_fields = ("reference_code", "last_error", "locked_by")


@admin.register(WorkerHeartbeat)
class WorkerHeartbeatAdmin(admin.ModelAdmin):
    list_display = ("worker_name", "last_seen_at", "processed_count", "queue_depth")
    search_fields = ("worker_name", "last_error")


@admin.register(AutomationAlert)
class AutomationAlertAdmin(admin.ModelAdmin):
    list_display = ("id", "alert_type", "severity", "status", "alert_key", "warehouse", "opened_at")
    list_filter = ("alert_type", "severity", "status")
    search_fields = ("alert_key", "summary")
