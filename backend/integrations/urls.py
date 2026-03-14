from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import CarrierBookingViewSet, IntegrationJobViewSet, IntegrationLogViewSet, WebhookEventViewSet

app_name = "integrations"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("jobs/", _action(IntegrationJobViewSet, {"get": "list", "post": "create"}), name="job-list"),
    re_path(r"^jobs/(?P<pk>\d+)/$", _action(IntegrationJobViewSet, {"get": "retrieve"}), name="job-detail"),
    re_path(r"^jobs/(?P<pk>\d+)/start/$", _action(IntegrationJobViewSet, {"post": "start"}), name="job-start"),
    re_path(r"^jobs/(?P<pk>\d+)/complete/$", _action(IntegrationJobViewSet, {"post": "complete"}), name="job-complete"),
    re_path(r"^jobs/(?P<pk>\d+)/fail/$", _action(IntegrationJobViewSet, {"post": "fail"}), name="job-fail"),
    path("webhooks/", _action(WebhookEventViewSet, {"get": "list", "post": "create"}), name="webhook-list"),
    re_path(r"^webhooks/(?P<pk>\d+)/$", _action(WebhookEventViewSet, {"get": "retrieve"}), name="webhook-detail"),
    re_path(r"^webhooks/(?P<pk>\d+)/process/$", _action(WebhookEventViewSet, {"post": "process"}), name="webhook-process"),
    path("logs/", _action(IntegrationLogViewSet, {"get": "list"}), name="log-list"),
    re_path(r"^logs/(?P<pk>\d+)/$", _action(IntegrationLogViewSet, {"get": "retrieve"}), name="log-detail"),
    path("carrier-bookings/", _action(CarrierBookingViewSet, {"get": "list", "post": "create"}), name="carrier-booking-list"),
    re_path(r"^carrier-bookings/(?P<pk>\d+)/$", _action(CarrierBookingViewSet, {"get": "retrieve"}), name="carrier-booking-detail"),
    re_path(
        r"^carrier-bookings/(?P<pk>\d+)/generate-label/$",
        _action(CarrierBookingViewSet, {"post": "generate_label"}),
        name="carrier-booking-generate-label",
    ),
]
