"""Serializers for handheld scanner sessions, telemetry, and offline replay."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .models import HandheldDeviceSession, HandheldTelemetrySample, OfflineReplayBatch, OfflineReplayEvent


class HandheldDeviceSessionSerializer(serializers.ModelSerializer[HandheldDeviceSession]):
    class Meta:
        model = HandheldDeviceSession
        fields = [
            "id",
            "operator",
            "device_id",
            "device_label",
            "app_version",
            "platform",
            "status",
            "session_started_at",
            "last_seen_at",
            "last_sync_at",
            "session_ended_at",
            "telemetry_sample_count",
            "total_scan_count",
            "total_sync_count",
            "total_replayed_count",
            "total_conflict_count",
            "total_failure_count",
            "last_battery_level",
            "last_network_type",
            "last_signal_strength",
            "notes",
            "metadata",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "operator",
            "status",
            "session_started_at",
            "last_seen_at",
            "last_sync_at",
            "session_ended_at",
            "telemetry_sample_count",
            "total_scan_count",
            "total_sync_count",
            "total_replayed_count",
            "total_conflict_count",
            "total_failure_count",
            "last_battery_level",
            "last_network_type",
            "last_signal_strength",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class HandheldSessionHeartbeatSerializer(serializers.Serializer[dict[str, object]]):
    app_version = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    metadata = serializers.JSONField(required=False, default=dict)


class HandheldSessionEndSerializer(serializers.Serializer[dict[str, object]]):
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class HandheldTelemetrySampleSerializer(serializers.ModelSerializer[HandheldTelemetrySample]):
    class Meta:
        model = HandheldTelemetrySample
        fields = [
            "id",
            "session",
            "operator",
            "recorded_at",
            "scan_count",
            "queued_event_count",
            "sync_count",
            "replay_conflict_count",
            "replay_failure_count",
            "battery_level",
            "network_type",
            "signal_strength",
            "latency_ms",
            "storage_free_mb",
            "metadata",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "operator",
            "recorded_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class OfflineReplayEventSerializer(serializers.ModelSerializer[OfflineReplayEvent]):
    class Meta:
        model = OfflineReplayEvent
        fields = [
            "id",
            "sequence_number",
            "event_type",
            "status",
            "payload",
            "processed_at",
            "result_record_type",
            "result_record_id",
            "conflict_rule",
            "conflict_type",
            "conflict_key",
            "result_summary",
            "error_message",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class OfflineReplayEventInputSerializer(serializers.Serializer[dict[str, object]]):
    sequence_number = serializers.IntegerField(min_value=1)
    event_type = serializers.ChoiceField(choices=OfflineReplayEvent._meta.get_field("event_type").choices)
    payload = serializers.JSONField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class OfflineReplayBatchSerializer(serializers.ModelSerializer[OfflineReplayBatch]):
    events = OfflineReplayEventSerializer(many=True, read_only=True)

    class Meta:
        model = OfflineReplayBatch
        fields = [
            "id",
            "session",
            "operator",
            "client_batch_id",
            "status",
            "submitted_at",
            "processed_at",
            "event_count",
            "replayed_count",
            "conflict_count",
            "failed_count",
            "last_error",
            "notes",
            "events",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "operator",
            "status",
            "submitted_at",
            "processed_at",
            "event_count",
            "replayed_count",
            "conflict_count",
            "failed_count",
            "last_error",
            "events",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class OfflineReplayBatchCreateSerializer(serializers.Serializer[dict[str, object]]):
    session = serializers.PrimaryKeyRelatedField(queryset=HandheldDeviceSession.objects.filter(is_delete=False))
    client_batch_id = serializers.CharField(max_length=128)
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    events = OfflineReplayEventInputSerializer(many=True)

    def validate_events(self, events):  # type: ignore[override]
        sequence_numbers = [int(item["sequence_number"]) for item in events]
        if len(sequence_numbers) != len(set(sequence_numbers)):
            raise serializers.ValidationError("sequence_number values must be unique within the batch")
        return events


class HandheldTelemetrySampleCreateSerializer(serializers.Serializer[dict[str, object]]):
    session = serializers.PrimaryKeyRelatedField(queryset=HandheldDeviceSession.objects.filter(is_delete=False))
    scan_count = serializers.IntegerField(required=False, min_value=0, default=0)
    queued_event_count = serializers.IntegerField(required=False, min_value=0, default=0)
    sync_count = serializers.IntegerField(required=False, min_value=0, default=0)
    replay_conflict_count = serializers.IntegerField(required=False, min_value=0, default=0)
    replay_failure_count = serializers.IntegerField(required=False, min_value=0, default=0)
    battery_level = serializers.IntegerField(required=False, min_value=0, max_value=100)
    network_type = serializers.CharField(required=False, allow_blank=True, default="")
    signal_strength = serializers.IntegerField(required=False)
    latency_ms = serializers.IntegerField(required=False, min_value=0)
    storage_free_mb = serializers.DecimalField(required=False, max_digits=18, decimal_places=4, min_value=Decimal("0.0000"))
    metadata = serializers.JSONField(required=False, default=dict)
