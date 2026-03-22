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
from apps.workorders.models import WorkOrder, WorkOrderType
from apps.workorders.services.work_order_service import (
    CreateWorkOrderInput,
    CreateWorkOrderTypeInput,
    create_work_order,
    create_work_order_type,
)


class WorkOrderAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("manager@example.com")
        self.staff = make_user("staff@example.com")
        self.viewer = make_user("viewer@example.com")

        self.manager_membership = add_membership(self.manager, self.organization)
        self.staff_membership = add_membership(self.staff, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in (
            "view_workorder",
            "manage_work_order_types",
            "manage_work_orders",
        ):
            permission = Permission.objects.get(
                content_type__app_label="workorders",
                codename=codename,
            )
            grant_role_permission(manager_role, permission)

        for codename in ("view_workorder", "manage_work_orders"):
            permission = Permission.objects.get(
                content_type__app_label="workorders",
                codename=codename,
            )
            grant_role_permission(staff_role, permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.staff_membership, staff_role)

        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Main Warehouse",
            code="main",
        )
        self.customer_account = make_customer_account(self.organization, name="Retail Client", code="RTL-1")

    def test_manager_can_create_work_order_type_and_order(self) -> None:
        self.client.force_authenticate(self.manager)

        type_response = self.client.post(
            reverse(
                "organization-work-order-type-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "code": "dropship-rush",
                "name": "Dropship rush",
                "description": "Rush dropship fulfillment",
                "workstream": WorkOrderType.Workstream.OUTBOUND,
                "default_urgency": WorkOrderType.Urgency.CRITICAL,
                "default_priority_score": 95,
                "target_sla_hours": 6,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(type_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(type_response.data["code"], "dropship-rush")

        order_response = self.client.post(
            reverse(
                "organization-work-order-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "work_order_type_id": type_response.data["id"],
                "warehouse_id": self.warehouse.id,
                "customer_account_id": self.customer_account.id,
                "title": "Fulfill SO-1001 first",
                "source_reference": "so-1001",
                "status": WorkOrder.Status.READY,
                "assignee_name": "Shift A",
                "scheduled_start_at": "2026-03-22T09:00:00Z",
                "estimated_duration_minutes": 45,
                "notes": "Expedite before 10am pickup",
            },
            format="json",
        )

        self.assertEqual(order_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(order_response.data["warehouse_name"], "Main Warehouse")
        self.assertEqual(order_response.data["urgency"], WorkOrderType.Urgency.CRITICAL)
        self.assertEqual(order_response.data["priority_score"], 95)
        self.assertTrue(order_response.data["display_code"].startswith("WO-"))

    def test_work_orders_list_is_sorted_by_open_urgency_priority_and_due_time(self) -> None:
        self.client.force_authenticate(self.staff)
        work_order_type = create_work_order_type(
            CreateWorkOrderTypeInput(
                organization=self.organization,
                code="inventory-review",
                name="Inventory review",
                workstream=WorkOrderType.Workstream.INVENTORY,
                default_urgency=WorkOrderType.Urgency.MEDIUM,
                default_priority_score=50,
                target_sla_hours=24,
            )
        )
        now = timezone.now()

        low_priority = create_work_order(
            CreateWorkOrderInput(
                organization=self.organization,
                work_order_type=work_order_type,
                warehouse=self.warehouse,
                title="Low urgency recount",
                status=WorkOrder.Status.READY,
                urgency=WorkOrderType.Urgency.LOW,
                priority_score=20,
                due_at=now + timedelta(hours=6),
            )
        )
        top_priority = create_work_order(
            CreateWorkOrderInput(
                organization=self.organization,
                work_order_type=work_order_type,
                warehouse=self.warehouse,
                title="Critical recount",
                status=WorkOrder.Status.SCHEDULED,
                urgency=WorkOrderType.Urgency.CRITICAL,
                priority_score=90,
                due_at=now + timedelta(hours=2),
            )
        )
        create_work_order(
            CreateWorkOrderInput(
                organization=self.organization,
                work_order_type=work_order_type,
                warehouse=self.warehouse,
                title="Already complete",
                status=WorkOrder.Status.COMPLETED,
                urgency=WorkOrderType.Urgency.CRITICAL,
                priority_score=100,
                due_at=now + timedelta(hours=1),
                completed_at=now,
            )
        )

        response = self.client.get(
            reverse(
                "organization-work-order-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {"warehouse_id": self.warehouse.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["id"], top_priority.id)
        self.assertEqual(response.data[0]["fulfillment_rank"], 1)
        self.assertEqual(response.data[1]["id"], low_priority.id)
        self.assertEqual(response.data[0]["sla_status"], WorkOrder.SlaStatus.DUE_SOON)
        self.assertEqual(response.data[-1]["status"], WorkOrder.Status.COMPLETED)

    def test_viewer_without_work_order_permissions_cannot_list(self) -> None:
        self.client.force_authenticate(self.viewer)

        response = self.client.get(
            reverse(
                "organization-work-order-list",
                kwargs={"organization_id": self.organization.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
