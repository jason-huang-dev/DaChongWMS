"""Serializers for integration jobs, webhooks, logs, and carrier bookings."""

from __future__ import annotations

from rest_framework import serializers

from .models import CarrierBooking, IntegrationJob, IntegrationLog, WebhookEvent


class IntegrationJobSerializer(serializers.ModelSerializer[IntegrationJob]):
    class Meta:
        model = IntegrationJob
        fields = [
            "id",
            "warehouse",
            "source_webhook",
            "system_type",
            "integration_name",
            "job_type",
            "direction",
            "status",
            "reference_code",
            "external_reference",
            "request_payload",
            "response_payload",
            "started_at",
            "completed_at",
            "attempt_count",
            "triggered_by",
            "last_error",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "response_payload",
            "started_at",
            "completed_at",
            "attempt_count",
            "triggered_by",
            "last_error",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class IntegrationJobCompleteSerializer(serializers.Serializer[dict[str, object]]):
    response_payload = serializers.JSONField(required=False, default=dict)


class IntegrationJobFailSerializer(serializers.Serializer[dict[str, object]]):
    error_message = serializers.CharField(max_length=500)
    response_payload = serializers.JSONField(required=False, default=dict)


class WebhookEventSerializer(serializers.ModelSerializer[WebhookEvent]):
    class Meta:
        model = WebhookEvent
        fields = [
            "id",
            "warehouse",
            "system_type",
            "source_system",
            "event_type",
            "event_key",
            "signature",
            "headers",
            "payload",
            "reference_code",
            "status",
            "received_at",
            "processed_at",
            "last_error",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "status",
            "received_at",
            "processed_at",
            "last_error",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class WebhookProcessSerializer(serializers.Serializer[dict[str, object]]):
    response_payload = serializers.JSONField(required=False, default=dict)


class IntegrationLogSerializer(serializers.ModelSerializer[IntegrationLog]):
    class Meta:
        model = IntegrationLog
        fields = [
            "id",
            "job",
            "webhook_event",
            "level",
            "message",
            "payload",
            "logged_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class CarrierBookingSerializer(serializers.ModelSerializer[CarrierBooking]):
    class Meta:
        model = CarrierBooking
        fields = [
            "id",
            "warehouse",
            "shipment",
            "booking_job",
            "label_job",
            "booking_number",
            "carrier_code",
            "service_level",
            "package_count",
            "total_weight",
            "status",
            "tracking_number",
            "label_format",
            "label_document",
            "external_reference",
            "request_payload",
            "response_payload",
            "booked_by",
            "booked_at",
            "labeled_at",
            "last_error",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "booking_job",
            "label_job",
            "status",
            "tracking_number",
            "label_format",
            "label_document",
            "response_payload",
            "booked_by",
            "booked_at",
            "labeled_at",
            "last_error",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class CarrierLabelSerializer(serializers.Serializer[dict[str, object]]):
    label_format = serializers.ChoiceField(choices=["PDF", "ZPL"], default="PDF")
