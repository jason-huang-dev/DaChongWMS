from django_filters import rest_framework as filters

from .models import CarrierBooking, IntegrationJob, IntegrationLog, WebhookEvent


class IntegrationJobFilter(filters.FilterSet):
    class Meta:
        model = IntegrationJob
        fields = {
            "warehouse": ["exact"],
            "system_type": ["exact"],
            "integration_name": ["exact", "icontains"],
            "job_type": ["exact"],
            "direction": ["exact"],
            "status": ["exact"],
            "reference_code": ["exact", "icontains"],
        }


class WebhookEventFilter(filters.FilterSet):
    class Meta:
        model = WebhookEvent
        fields = {
            "warehouse": ["exact"],
            "system_type": ["exact"],
            "source_system": ["exact", "icontains"],
            "event_type": ["exact", "icontains"],
            "event_key": ["exact", "icontains"],
            "status": ["exact"],
            "reference_code": ["exact", "icontains"],
        }


class IntegrationLogFilter(filters.FilterSet):
    class Meta:
        model = IntegrationLog
        fields = {
            "job": ["exact"],
            "webhook_event": ["exact"],
            "level": ["exact"],
        }


class CarrierBookingFilter(filters.FilterSet):
    class Meta:
        model = CarrierBooking
        fields = {
            "warehouse": ["exact"],
            "shipment": ["exact"],
            "carrier_code": ["exact", "icontains"],
            "service_level": ["exact", "icontains"],
            "status": ["exact"],
            "tracking_number": ["exact", "icontains"],
        }
