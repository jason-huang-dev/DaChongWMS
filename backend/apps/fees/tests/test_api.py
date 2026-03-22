from __future__ import annotations

from datetime import timedelta

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
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


class FeesAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("finance-manager@example.com")
        self.viewer = make_user("finance-viewer@example.com")

        self.manager_membership = add_membership(self.manager, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in (
            "view_fees",
            "manage_balance_transactions",
            "review_balance_transactions",
            "manage_vouchers",
            "manage_charge_catalog",
            "manage_manual_charges",
            "manage_fund_flows",
            "manage_rent_details",
            "manage_business_expenses",
            "manage_receivable_bills",
            "manage_profit_calculations",
        ):
            permission = Permission.objects.get(content_type__app_label="fees", codename=codename)
            grant_role_permission(manager_role, permission)

        view_permission = Permission.objects.get(content_type__app_label="fees", codename="view_fees")
        grant_role_permission(staff_role, view_permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.viewer_membership, staff_role)

        self.customer_account = make_customer_account(self.organization, name="Retail Client", code="RTL-1")
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Main Warehouse",
            code="main",
        )

    def test_manager_can_create_fee_records(self) -> None:
        self.client.force_authenticate(self.manager)

        charge_item_response = self.client.post(
            reverse("organization-charge-item-list", kwargs={"organization_id": self.organization.id}),
            {
                "code": "STORAGE_DAY",
                "name": "Daily storage",
                "category": "STORAGE",
                "billing_basis": "PER_DAY",
                "default_unit_price": "2.50",
                "currency": "usd",
                "unit_label": "day",
                "is_taxable": True,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(charge_item_response.status_code, status.HTTP_201_CREATED)
        charge_item_id = charge_item_response.data["id"]

        voucher_response = self.client.post(
            reverse("organization-voucher-list", kwargs={"organization_id": self.organization.id}),
            {
                "customer_account": self.customer_account.id,
                "code": "RCG-2026-001",
                "voucher_type": "RECHARGE",
                "status": "ACTIVE",
                "face_value": "500.00",
                "remaining_value": "500.00",
                "currency": "usd",
                "valid_from": "2026-03-01",
                "expires_on": "2026-12-31",
            },
            format="json",
        )
        self.assertEqual(voucher_response.status_code, status.HTTP_201_CREATED)
        voucher_id = voucher_response.data["id"]

        balance_transaction_response = self.client.post(
            reverse("organization-balance-transaction-list", kwargs={"organization_id": self.organization.id}),
            {
                "customer_account": self.customer_account.id,
                "voucher": voucher_id,
                "transaction_type": "RECHARGE",
                "status": "PENDING_REVIEW",
                "reference_code": "BAL-001",
                "amount": "500.00",
                "currency": "usd",
                "requested_by_name": "Finance Manager",
                "requested_at": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(balance_transaction_response.status_code, status.HTTP_201_CREATED)

        charge_template_response = self.client.post(
            reverse("organization-charge-template-list", kwargs={"organization_id": self.organization.id}),
            {
                "charge_item": charge_item_id,
                "warehouse": self.warehouse.id,
                "customer_account": self.customer_account.id,
                "code": "STORAGE_STD",
                "name": "Standard storage template",
                "default_quantity": "1.00",
                "default_unit_price": "2.50",
                "currency": "usd",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(charge_template_response.status_code, status.HTTP_201_CREATED)
        charge_template_id = charge_template_response.data["id"]

        manual_charge_response = self.client.post(
            reverse("organization-manual-charge-list", kwargs={"organization_id": self.organization.id}),
            {
                "customer_account": self.customer_account.id,
                "warehouse": self.warehouse.id,
                "charge_item": charge_item_id,
                "charge_template": charge_template_id,
                "status": "PENDING_REVIEW",
                "source_reference": "MCH-001",
                "description": "Manual storage correction",
                "quantity": "3.00",
                "unit_price": "2.50",
                "currency": "usd",
                "charged_at": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(manual_charge_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(manual_charge_response.data["amount"], "7.50")

        fund_flow_response = self.client.post(
            reverse("organization-fund-flow-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse": self.warehouse.id,
                "customer_account": self.customer_account.id,
                "flow_type": "INBOUND",
                "source_type": "RECHARGE",
                "reference_code": "FLOW-001",
                "status": "POSTED",
                "amount": "500.00",
                "currency": "usd",
                "occurred_at": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(fund_flow_response.status_code, status.HTTP_201_CREATED)

        rent_detail_response = self.client.post(
            reverse("organization-rent-detail-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse": self.warehouse.id,
                "customer_account": self.customer_account.id,
                "period_start": "2026-03-01",
                "period_end": "2026-03-31",
                "pallet_positions": 10,
                "bin_positions": 5,
                "area_sqm": "25.50",
                "amount": "1200.00",
                "currency": "usd",
                "status": "ACCRUED",
            },
            format="json",
        )
        self.assertEqual(rent_detail_response.status_code, status.HTTP_201_CREATED)

        expense_response = self.client.post(
            reverse("organization-business-expense-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse": self.warehouse.id,
                "vendor_name": "Utility Co",
                "expense_category": "UTILITIES",
                "status": "PENDING_REVIEW",
                "expense_date": "2026-03-15",
                "amount": "220.00",
                "currency": "usd",
                "reference_code": "EXP-001",
            },
            format="json",
        )
        self.assertEqual(expense_response.status_code, status.HTTP_201_CREATED)

        receivable_bill_response = self.client.post(
            reverse("organization-receivable-bill-list", kwargs={"organization_id": self.organization.id}),
            {
                "customer_account": self.customer_account.id,
                "warehouse": self.warehouse.id,
                "bill_number": "ARB-1001",
                "period_start": "2026-03-01",
                "period_end": "2026-03-31",
                "status": "OPEN",
                "subtotal_amount": "1400.00",
                "adjustment_amount": "-50.00",
                "currency": "usd",
                "due_at": (timezone.now() + timedelta(days=30)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(receivable_bill_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(receivable_bill_response.data["total_amount"], "1350.00")

        profit_response = self.client.post(
            reverse("organization-profit-calculation-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse": self.warehouse.id,
                "customer_account": self.customer_account.id,
                "period_start": "2026-03-01",
                "period_end": "2026-03-31",
                "revenue_amount": "1500.00",
                "expense_amount": "300.00",
                "recharge_amount": "500.00",
                "deduction_amount": "100.00",
                "receivable_amount": "1350.00",
                "status": "FINALIZED",
                "generated_at": timezone.now().isoformat(),
            },
            format="json",
        )
        self.assertEqual(profit_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(profit_response.data["profit_amount"], "1600.00")

    def test_viewer_can_list_fee_records_but_cannot_create(self) -> None:
        self.client.force_authenticate(self.viewer)

        response = self.client.get(
            reverse("organization-charge-item-list", kwargs={"organization_id": self.organization.id})
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        create_response = self.client.post(
            reverse("organization-charge-item-list", kwargs={"organization_id": self.organization.id}),
            {
                "code": "MANUAL_FEE",
                "name": "Manual fee",
                "category": "MANUAL",
                "billing_basis": "FLAT",
                "default_unit_price": "10.00",
                "currency": "USD",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

