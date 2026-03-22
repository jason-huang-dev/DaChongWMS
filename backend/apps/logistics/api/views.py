from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework.generics import ListCreateAPIView, RetrieveUpdateAPIView
from rest_framework.request import Request

from apps.logistics.models import (
    CustomerLogisticsChannel,
    FuelRule,
    LogisticsCharge,
    LogisticsChargingStrategy,
    LogisticsCost,
    LogisticsGroup,
    LogisticsProvider,
    LogisticsProviderChannel,
    LogisticsRule,
    PartitionRule,
    RemoteAreaRule,
    SpecialCustomerLogisticsCharging,
    WaybillWatermark,
)
from apps.logistics.permissions import (
    CanManageLogisticsCharging,
    CanManageLogisticsCosts,
    CanManageLogisticsProviders,
    CanManageLogisticsRules,
    CanViewLogistics,
)
from apps.logistics.serializers import (
    CustomerLogisticsChannelSerializer,
    FuelRuleSerializer,
    LogisticsChargeSerializer,
    LogisticsChargingStrategySerializer,
    LogisticsCostSerializer,
    LogisticsGroupSerializer,
    LogisticsProviderChannelSerializer,
    LogisticsProviderSerializer,
    LogisticsRuleSerializer,
    PartitionRuleSerializer,
    RemoteAreaRuleSerializer,
    SpecialCustomerLogisticsChargingSerializer,
    WaybillWatermarkSerializer,
)
from apps.organizations.models import Organization


class OrganizationLogisticsBaseAPIView:
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)

    def _filter_queryset(self, queryset):
        return queryset.filter(organization=self.organization)

    def _provider_channel_filters(self, queryset):
        channel_mode = self.request.query_params.get("channel_mode")
        if channel_mode:
            queryset = queryset.filter(channel_mode=channel_mode)
        provider_id = self.request.query_params.get("provider_id")
        if provider_id:
            queryset = queryset.filter(provider_id=provider_id)
        return queryset


class OrganizationLogisticsProviderListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = LogisticsProviderSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsProviders()]

    def get_queryset(self):
        return self._filter_queryset(LogisticsProvider.objects.all())

    def perform_create(self, serializer: LogisticsProviderSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationLogisticsProviderDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = LogisticsProviderSerializer
    lookup_url_kwarg = "provider_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsProviders()]

    def get_queryset(self):
        return self._filter_queryset(LogisticsProvider.objects.all())


class OrganizationLogisticsGroupListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = LogisticsGroupSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsProviders()]

    def get_queryset(self):
        return self._filter_queryset(LogisticsGroup.objects.all())

    def perform_create(self, serializer: LogisticsGroupSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationLogisticsGroupDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = LogisticsGroupSerializer
    lookup_url_kwarg = "logistics_group_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsProviders()]

    def get_queryset(self):
        return self._filter_queryset(LogisticsGroup.objects.all())


class OrganizationLogisticsProviderChannelListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = LogisticsProviderChannelSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsProviders()]

    def get_queryset(self):
        queryset = self._filter_queryset(
            LogisticsProviderChannel.objects.select_related("provider", "logistics_group")
        )
        return self._provider_channel_filters(queryset)

    def perform_create(self, serializer: LogisticsProviderChannelSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationLogisticsProviderChannelDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = LogisticsProviderChannelSerializer
    lookup_url_kwarg = "provider_channel_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsProviders()]

    def get_queryset(self):
        return self._filter_queryset(
            LogisticsProviderChannel.objects.select_related("provider", "logistics_group")
        )


class OrganizationCustomerLogisticsChannelListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = CustomerLogisticsChannelSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsProviders()]

    def get_queryset(self):
        queryset = self._filter_queryset(
            CustomerLogisticsChannel.objects.select_related("customer_account", "provider_channel")
        )
        customer_account_id = self.request.query_params.get("customer_account_id")
        if customer_account_id:
            queryset = queryset.filter(customer_account_id=customer_account_id)
        return queryset

    def perform_create(self, serializer: CustomerLogisticsChannelSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationCustomerLogisticsChannelDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = CustomerLogisticsChannelSerializer
    lookup_url_kwarg = "customer_channel_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsProviders()]

    def get_queryset(self):
        return self._filter_queryset(
            CustomerLogisticsChannel.objects.select_related("customer_account", "provider_channel")
        )


class OrganizationLogisticsRuleListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = LogisticsRuleSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsRules()]

    def get_queryset(self):
        queryset = self._filter_queryset(
            LogisticsRule.objects.select_related("logistics_group", "provider_channel", "warehouse")
        )
        rule_scope = self.request.query_params.get("rule_scope")
        if rule_scope:
            queryset = queryset.filter(rule_scope=rule_scope)
        return queryset

    def perform_create(self, serializer: LogisticsRuleSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationLogisticsRuleDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = LogisticsRuleSerializer
    lookup_url_kwarg = "logistics_rule_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsRules()]

    def get_queryset(self):
        return self._filter_queryset(
            LogisticsRule.objects.select_related("logistics_group", "provider_channel", "warehouse")
        )


class OrganizationPartitionRuleListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = PartitionRuleSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsRules()]

    def get_queryset(self):
        return self._filter_queryset(
            PartitionRule.objects.select_related("logistics_group", "provider_channel")
        )

    def perform_create(self, serializer: PartitionRuleSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationPartitionRuleDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = PartitionRuleSerializer
    lookup_url_kwarg = "partition_rule_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsRules()]

    def get_queryset(self):
        return self._filter_queryset(
            PartitionRule.objects.select_related("logistics_group", "provider_channel")
        )


class OrganizationRemoteAreaRuleListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = RemoteAreaRuleSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsRules()]

    def get_queryset(self):
        queryset = self._filter_queryset(RemoteAreaRule.objects.select_related("provider_channel"))
        provider_channel_id = self.request.query_params.get("provider_channel_id")
        if provider_channel_id:
            queryset = queryset.filter(provider_channel_id=provider_channel_id)
        return queryset

    def perform_create(self, serializer: RemoteAreaRuleSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationRemoteAreaRuleDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = RemoteAreaRuleSerializer
    lookup_url_kwarg = "remote_area_rule_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsRules()]

    def get_queryset(self):
        return self._filter_queryset(RemoteAreaRule.objects.select_related("provider_channel"))


class OrganizationFuelRuleListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = FuelRuleSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsRules()]

    def get_queryset(self):
        queryset = self._filter_queryset(FuelRule.objects.select_related("provider_channel"))
        provider_channel_id = self.request.query_params.get("provider_channel_id")
        if provider_channel_id:
            queryset = queryset.filter(provider_channel_id=provider_channel_id)
        return queryset

    def perform_create(self, serializer: FuelRuleSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationFuelRuleDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = FuelRuleSerializer
    lookup_url_kwarg = "fuel_rule_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsRules()]

    def get_queryset(self):
        return self._filter_queryset(FuelRule.objects.select_related("provider_channel"))


class OrganizationWaybillWatermarkListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = WaybillWatermarkSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsProviders()]

    def get_queryset(self):
        return self._filter_queryset(WaybillWatermark.objects.all())

    def perform_create(self, serializer: WaybillWatermarkSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationWaybillWatermarkDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = WaybillWatermarkSerializer
    lookup_url_kwarg = "waybill_watermark_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsProviders()]

    def get_queryset(self):
        return self._filter_queryset(WaybillWatermark.objects.all())


class OrganizationLogisticsChargingStrategyListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = LogisticsChargingStrategySerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsCharging()]

    def get_queryset(self):
        return self._filter_queryset(
            LogisticsChargingStrategy.objects.select_related("logistics_group", "provider_channel")
        )

    def perform_create(self, serializer: LogisticsChargingStrategySerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationLogisticsChargingStrategyDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = LogisticsChargingStrategySerializer
    lookup_url_kwarg = "charging_strategy_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsCharging()]

    def get_queryset(self):
        return self._filter_queryset(
            LogisticsChargingStrategy.objects.select_related("logistics_group", "provider_channel")
        )


class OrganizationSpecialCustomerLogisticsChargingListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = SpecialCustomerLogisticsChargingSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsCharging()]

    def get_queryset(self):
        queryset = self._filter_queryset(
            SpecialCustomerLogisticsCharging.objects.select_related(
                "customer_account",
                "provider_channel",
                "charging_strategy",
            )
        )
        customer_account_id = self.request.query_params.get("customer_account_id")
        if customer_account_id:
            queryset = queryset.filter(customer_account_id=customer_account_id)
        return queryset

    def perform_create(self, serializer: SpecialCustomerLogisticsChargingSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationSpecialCustomerLogisticsChargingDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = SpecialCustomerLogisticsChargingSerializer
    lookup_url_kwarg = "special_customer_charging_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsCharging()]

    def get_queryset(self):
        return self._filter_queryset(
            SpecialCustomerLogisticsCharging.objects.select_related(
                "customer_account",
                "provider_channel",
                "charging_strategy",
            )
        )


class OrganizationLogisticsChargeListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = LogisticsChargeSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsCharging()]

    def get_queryset(self):
        queryset = self._filter_queryset(
            LogisticsCharge.objects.select_related(
                "customer_account",
                "provider_channel",
                "charging_strategy",
                "warehouse",
            )
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_create(self, serializer: LogisticsChargeSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationLogisticsChargeDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = LogisticsChargeSerializer
    lookup_url_kwarg = "logistics_charge_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsCharging()]

    def get_queryset(self):
        return self._filter_queryset(
            LogisticsCharge.objects.select_related(
                "customer_account",
                "provider_channel",
                "charging_strategy",
                "warehouse",
            )
        )


class OrganizationLogisticsCostListCreateAPIView(OrganizationLogisticsBaseAPIView, ListCreateAPIView):
    serializer_class = LogisticsCostSerializer

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsCosts()]

    def get_queryset(self):
        queryset = self._filter_queryset(
            LogisticsCost.objects.select_related("provider_channel", "warehouse")
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    def perform_create(self, serializer: LogisticsCostSerializer) -> None:
        serializer.save(organization=self.organization)


class OrganizationLogisticsCostDetailAPIView(OrganizationLogisticsBaseAPIView, RetrieveUpdateAPIView):
    serializer_class = LogisticsCostSerializer
    lookup_url_kwarg = "logistics_cost_id"

    def get_permissions(self) -> list[object]:
        return [CanViewLogistics()] if self.request.method == "GET" else [CanManageLogisticsCosts()]

    def get_queryset(self):
        return self._filter_queryset(
            LogisticsCost.objects.select_related("provider_channel", "warehouse")
        )

