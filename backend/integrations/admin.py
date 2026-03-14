from django.contrib import admin

from .models import CarrierBooking, IntegrationJob, IntegrationLog, WebhookEvent


@admin.register(IntegrationJob)
class IntegrationJobAdmin(admin.ModelAdmin):
    list_display = ("id", "integration_name", "job_type", "status", "warehouse", "openid", "create_time")
    list_filter = ("system_type", "job_type", "status")
    search_fields = ("integration_name", "reference_code", "external_reference")


@admin.register(WebhookEvent)
class WebhookEventAdmin(admin.ModelAdmin):
    list_display = ("id", "source_system", "event_type", "event_key", "status", "openid", "received_at")
    list_filter = ("system_type", "status", "source_system")
    search_fields = ("event_key", "event_type", "reference_code")


@admin.register(IntegrationLog)
class IntegrationLogAdmin(admin.ModelAdmin):
    list_display = ("id", "level", "job", "webhook_event", "logged_at")
    list_filter = ("level",)
    search_fields = ("message",)


@admin.register(CarrierBooking)
class CarrierBookingAdmin(admin.ModelAdmin):
    list_display = ("id", "booking_number", "carrier_code", "status", "tracking_number", "warehouse", "openid")
    list_filter = ("carrier_code", "status")
    search_fields = ("booking_number", "tracking_number", "external_reference")
