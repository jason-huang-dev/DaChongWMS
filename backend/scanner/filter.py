from django_filters import rest_framework as filters

from .models import HandheldDeviceSession, HandheldTelemetrySample, OfflineReplayBatch


class HandheldDeviceSessionFilter(filters.FilterSet):
    class Meta:
        model = HandheldDeviceSession
        fields = {
            "operator": ["exact"],
            "device_id": ["exact", "icontains"],
            "status": ["exact"],
            "platform": ["exact", "icontains"],
            "last_seen_at": ["gte", "lte"],
        }


class OfflineReplayBatchFilter(filters.FilterSet):
    class Meta:
        model = OfflineReplayBatch
        fields = {
            "session": ["exact"],
            "operator": ["exact"],
            "client_batch_id": ["exact", "icontains"],
            "status": ["exact"],
            "submitted_at": ["gte", "lte"],
            "processed_at": ["gte", "lte"],
        }


class HandheldTelemetrySampleFilter(filters.FilterSet):
    class Meta:
        model = HandheldTelemetrySample
        fields = {
            "session": ["exact"],
            "operator": ["exact"],
            "recorded_at": ["gte", "lte"],
            "battery_level": ["exact", "gte", "lte"],
            "network_type": ["exact", "icontains"],
        }
