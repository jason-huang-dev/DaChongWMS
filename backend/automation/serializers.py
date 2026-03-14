"""Serializers for database-backed worker configuration."""

from __future__ import annotations

from datetime import date

from rest_framework import serializers

from .models import AutomationAlert, BackgroundTask, BackgroundTaskType, ScheduledTask, WorkerHeartbeat


class ScheduledTaskSerializer(serializers.ModelSerializer[ScheduledTask]):
    def validate(self, attrs):
        task_type = attrs.get("task_type") or getattr(self.instance, "task_type", None)
        payload = attrs.get("payload", getattr(self.instance, "payload", {})) or {}
        customer = attrs.get("customer", getattr(self.instance, "customer", None))
        if task_type == BackgroundTaskType.PROCESS_INTEGRATION_JOB:
            raise serializers.ValidationError({"task_type": "Scheduled tasks do not support PROCESS_INTEGRATION_JOB"})
        if task_type == BackgroundTaskType.GENERATE_OPERATIONAL_REPORT and not payload.get("report_type"):
            raise serializers.ValidationError({"payload": "Operational report schedules require payload.report_type"})
        if task_type == BackgroundTaskType.GENERATE_STORAGE_ACCRUAL:
            if customer is None:
                raise serializers.ValidationError({"customer": "Storage accrual schedules require a customer"})
            if payload.get("accrual_date"):
                try:
                    date.fromisoformat(str(payload["accrual_date"]))
                except ValueError as exc:
                    raise serializers.ValidationError({"payload": "Storage accrual schedules require an ISO accrual_date"}) from exc
        if task_type == BackgroundTaskType.GENERATE_INVOICE:
            if customer is None:
                raise serializers.ValidationError({"customer": "Invoice schedules require a customer"})
            period_start = payload.get("period_start")
            period_end = payload.get("period_end")
            if not period_start or not period_end:
                raise serializers.ValidationError({"payload": "Invoice schedules require period_start and period_end"})
            if not payload.get("invoice_number") and not payload.get("invoice_prefix"):
                raise serializers.ValidationError({"payload": "Invoice schedules require invoice_number or invoice_prefix"})
            try:
                if date.fromisoformat(str(period_start)) > date.fromisoformat(str(period_end)):
                    raise serializers.ValidationError({"payload": "Invoice schedule period_start cannot be after period_end"})
            except ValueError as exc:
                raise serializers.ValidationError({"payload": "Invoice schedules require ISO date strings"}) from exc
        if task_type == BackgroundTaskType.GENERATE_FINANCE_EXPORT:
            period_start = payload.get("period_start")
            period_end = payload.get("period_end")
            if not period_start or not period_end:
                raise serializers.ValidationError({"payload": "Finance export schedules require period_start and period_end"})
            try:
                if date.fromisoformat(str(period_start)) > date.fromisoformat(str(period_end)):
                    raise serializers.ValidationError({"payload": "Finance export period_start cannot be after period_end"})
            except ValueError as exc:
                raise serializers.ValidationError({"payload": "Finance export schedules require ISO date strings"}) from exc
        return attrs

    class Meta:
        model = ScheduledTask
        fields = [
            "id",
            "warehouse",
            "customer",
            "name",
            "task_type",
            "interval_minutes",
            "next_run_at",
            "priority",
            "max_attempts",
            "is_active",
            "payload",
            "last_enqueued_at",
            "last_completed_at",
            "last_error",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["last_enqueued_at", "last_completed_at", "last_error", "creator", "openid", "create_time", "update_time"]


class BackgroundTaskSerializer(serializers.ModelSerializer[BackgroundTask]):
    class Meta:
        model = BackgroundTask
        fields = [
            "id",
            "scheduled_task",
            "warehouse",
            "customer",
            "integration_job",
            "report_export",
            "invoice",
            "task_type",
            "status",
            "priority",
            "available_at",
            "started_at",
            "completed_at",
            "attempt_count",
            "max_attempts",
            "retry_backoff_seconds",
            "locked_by",
            "reference_code",
            "payload",
            "result_summary",
            "last_error",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class WorkerHeartbeatSerializer(serializers.ModelSerializer[WorkerHeartbeat]):
    class Meta:
        model = WorkerHeartbeat
        fields = [
            "id",
            "worker_name",
            "last_seen_at",
            "last_run_started_at",
            "last_run_completed_at",
            "processed_count",
            "queue_depth",
            "last_error",
            "metadata",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class AutomationAlertSerializer(serializers.ModelSerializer[AutomationAlert]):
    class Meta:
        model = AutomationAlert
        fields = [
            "id",
            "warehouse",
            "scheduled_task",
            "background_task",
            "alert_type",
            "severity",
            "status",
            "alert_key",
            "summary",
            "payload",
            "opened_at",
            "resolved_at",
            "resolved_by",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields
