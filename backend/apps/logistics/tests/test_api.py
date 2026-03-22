from __future__ import annotations

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
from apps.logistics.models import LogisticsProvider
from apps.organizations.tests.test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_customer_account,
    make_organization,
    make_role,
    make_user,
)
from apps.warehouse.models import Warehouse


class LogisticsAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("manager@example.com")
        self.viewer = make_user("viewer@example.com")

        self.manager_membership = add_membership(self.manager, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in (
            "view_logistics",
            "manage_logistics_providers",
            "manage_logistics_rules",
            "manage_logistics_charging",
            "manage_logistics_costs",
        ):
            permission = Permission.objects.get(
                content_type__app_label="logistics",
                codename=codename,
            )
            grant_role_permission(manager_role, permission)

        view_permission = Permission.objects.get(
            content_type__app_label="logistics",
            codename="view_logistics",
        )
        grant_role_permission(staff_role, view_permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.viewer_membership, staff_role)

        self.customer_account = make_customer_account(self.organization, name="Retail Client", code="RTL-1")
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Main Warehouse",
            code="main",
        )

    def test_manager_can_create_logistics_configuration_and_financial_records(self) -> None:
        self.client.force_authenticate(self.manager)

        provider_response = self.client.post(
            reverse("organization-logistics-provider-list", kwargs={"organization_id": self.organization.id}),
            {
                "code": "yunexpress",
                "name": "YunExpress",
                "provider_type": "CARRIER",
                "integration_mode": "HYBRID",
                "supports_online_booking": True,
                "supports_offline_booking": True,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(provider_response.status_code, status.HTTP_201_CREATED)
        provider_id = provider_response.data["id"]

        group_response = self.client.post(
            reverse("organization-logistics-group-list", kwargs={"organization_id": self.organization.id}),
            {
                "code": "dropship-default",
                "name": "Dropship default",
                "description": "Default group for standard dropship routing",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(group_response.status_code, status.HTTP_201_CREATED)
        logistics_group_id = group_response.data["id"]

        channel_response = self.client.post(
            reverse("organization-logistics-provider-channel-list", kwargs={"organization_id": self.organization.id}),
            {
                "provider": provider_id,
                "logistics_group": logistics_group_id,
                "code": "yu-exp-us",
                "name": "YunExpress US Standard",
                "channel_mode": "ONLINE",
                "transport_mode": "EXPRESS",
                "service_level": "US Standard",
                "supports_waybill": True,
                "supports_tracking": True,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(channel_response.status_code, status.HTTP_201_CREATED)
        provider_channel_id = channel_response.data["id"]

        customer_channel_response = self.client.post(
            reverse("organization-customer-logistics-channel-list", kwargs={"organization_id": self.organization.id}),
            {
                "customer_account": self.customer_account.id,
                "provider_channel": provider_channel_id,
                "client_channel_name": "Client US Primary",
                "external_account_number": "acct-001",
                "priority": 90,
                "is_default": True,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(customer_channel_response.status_code, status.HTTP_201_CREATED)

        rule_response = self.client.post(
            reverse("organization-logistics-rule-list", kwargs={"organization_id": self.organization.id}),
            {
                "logistics_group": logistics_group_id,
                "provider_channel": provider_channel_id,
                "warehouse": self.warehouse.id,
                "name": "US standard online routing",
                "rule_scope": "ONLINE",
                "destination_country": "us",
                "shipping_method": "Standard",
                "min_weight_kg": "0.00",
                "max_weight_kg": "30.00",
                "priority": 80,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(rule_response.status_code, status.HTTP_201_CREATED)

        partition_response = self.client.post(
            reverse("organization-partition-rule-list", kwargs={"organization_id": self.organization.id}),
            {
                "logistics_group": logistics_group_id,
                "provider_channel": provider_channel_id,
                "name": "B2B partition",
                "partition_key": "ORDER_TYPE",
                "partition_value": "B2B",
                "handling_action": "Route to account-managed B2B channel",
                "priority": 75,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(partition_response.status_code, status.HTTP_201_CREATED)

        remote_area_response = self.client.post(
            reverse("organization-remote-area-rule-list", kwargs={"organization_id": self.organization.id}),
            {
                "provider_channel": provider_channel_id,
                "country_code": "US",
                "postal_code_pattern": "995*",
                "city_name": "Anchorage",
                "surcharge_amount": "12.50",
                "currency": "usd",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(remote_area_response.status_code, status.HTTP_201_CREATED)

        fuel_rule_response = self.client.post(
            reverse("organization-fuel-rule-list", kwargs={"organization_id": self.organization.id}),
            {
                "provider_channel": provider_channel_id,
                "effective_from": "2026-03-01",
                "effective_to": "2026-03-31",
                "surcharge_percent": "8.50",
                "minimum_charge": "0.00",
                "maximum_charge": "25.00",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(fuel_rule_response.status_code, status.HTTP_201_CREATED)

        watermark_response = self.client.post(
            reverse("organization-waybill-watermark-list", kwargs={"organization_id": self.organization.id}),
            {
                "name": "Fragile label",
                "watermark_text": "FRAGILE / HANDLE WITH CARE",
                "position": "DIAGONAL",
                "opacity_percent": 28,
                "applies_to_online": True,
                "applies_to_offline": False,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(watermark_response.status_code, status.HTTP_201_CREATED)

        strategy_response = self.client.post(
            reverse("organization-logistics-charging-strategy-list", kwargs={"organization_id": self.organization.id}),
            {
                "logistics_group": logistics_group_id,
                "provider_channel": provider_channel_id,
                "name": "US standard rated shipping",
                "charging_basis": "PER_PACKAGE",
                "currency": "usd",
                "base_fee": "2.00",
                "unit_fee": "0.75",
                "minimum_charge": "3.50",
                "includes_fuel_rule": True,
                "includes_remote_area_fee": True,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(strategy_response.status_code, status.HTTP_201_CREATED)
        charging_strategy_id = strategy_response.data["id"]

        special_response = self.client.post(
            reverse(
                "organization-special-customer-logistics-charging-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "customer_account": self.customer_account.id,
                "provider_channel": provider_channel_id,
                "charging_strategy": charging_strategy_id,
                "base_fee_override": "1.50",
                "unit_fee_override": "0.50",
                "minimum_charge_override": "2.50",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(special_response.status_code, status.HTTP_201_CREATED)

        charged_at = timezone.now().isoformat()
        charge_response = self.client.post(
            reverse("organization-logistics-charge-list", kwargs={"organization_id": self.organization.id}),
            {
                "customer_account": self.customer_account.id,
                "provider_channel": provider_channel_id,
                "charging_strategy": charging_strategy_id,
                "warehouse": self.warehouse.id,
                "source_reference": "SO-1001",
                "billing_reference": "BILL-1001",
                "status": "PENDING_REVIEW",
                "currency": "usd",
                "base_amount": "12.00",
                "fuel_amount": "1.25",
                "remote_area_amount": "0.00",
                "surcharge_amount": "2.00",
                "charged_at": charged_at,
            },
            format="json",
        )
        self.assertEqual(charge_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(charge_response.data["total_amount"], "15.25")

        cost_response = self.client.post(
            reverse("organization-logistics-cost-list", kwargs={"organization_id": self.organization.id}),
            {
                "provider_channel": provider_channel_id,
                "warehouse": self.warehouse.id,
                "source_reference": "SO-1001",
                "cost_reference": "COST-1001",
                "status": "POSTED",
                "currency": "usd",
                "linehaul_amount": "8.00",
                "fuel_amount": "1.20",
                "remote_area_amount": "0.00",
                "other_amount": "0.80",
                "incurred_at": charged_at,
            },
            format="json",
        )
        self.assertEqual(cost_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(cost_response.data["total_amount"], "10.00")

    def test_viewer_can_list_providers_but_cannot_create(self) -> None:
        LogisticsProvider.objects.create(
            organization=self.organization,
            code="YUNEXPRESS",
            name="YunExpress",
        )
        self.client.force_authenticate(self.viewer)

        list_response = self.client.get(
            reverse("organization-logistics-provider-list", kwargs={"organization_id": self.organization.id})
        )
        create_response = self.client.post(
            reverse("organization-logistics-provider-list", kwargs={"organization_id": self.organization.id}),
            {
                "code": "fedex",
                "name": "FedEx",
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
