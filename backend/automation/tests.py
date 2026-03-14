from __future__ import annotations

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from customer.models import ListModel as Customer
from integrations.models import IntegrationDirection, IntegrationJob, IntegrationJobStatus, IntegrationJobType, IntegrationSystemType
from reporting.models import BillingChargeEvent, BillingChargeStatus, BillingChargeType, BillingRateContract, FinanceApprovalStatus, Invoice, InvoiceFinanceApproval, InvoiceStatus, OperationalReportType, StorageAccrualRun
from staff.models import ListModel as Staff
from userprofile.models import Users
from warehouse.models import Warehouse

from .models import AutomationAlert, AutomationAlertType, BackgroundTask, BackgroundTaskStatus, BackgroundTaskType, ScheduledTask, WorkerHeartbeat
from .services import enqueue_due_scheduled_tasks, run_background_tasks
from .views import BackgroundTaskViewSet, ScheduledTaskViewSet, WorkerHeartbeatViewSet


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Automation Owner",
        "vip": 1,
        "openid": "automation-openid",
        "appid": "automation-appid",
        "t_code": "automation-t",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_staff(**overrides: Any) -> Staff:
    defaults = {
        "staff_name": "Automation Manager",
        "staff_type": "Manager",
        "check_code": 1234,
        "openid": "automation-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


def create_warehouse(**overrides: Any) -> Warehouse:
    defaults = {
        "warehouse_name": "Automation Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "100 Worker Ave",
        "warehouse_contact": "555-1000",
        "warehouse_manager": "Worker Lead",
        "creator": "creator",
        "openid": "automation-openid",
    }
    defaults.update(overrides)
    return Warehouse.objects.create(**defaults)


def create_customer(**overrides: Any) -> Customer:
    defaults = {
        "customer_name": "Automation Customer",
        "customer_city": "New York",
        "customer_address": "22 Invoice Rd",
        "customer_contact": "555-2200",
        "customer_manager": "Customer Lead",
        "creator": "creator",
        "openid": "automation-openid",
    }
    defaults.update(overrides)
    return Customer.objects.create(**defaults)


class AutomationTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="automation-openid", appid="automation-appid")
        self.user = get_user_model().objects.create_user(username="automation-api", password="password")
        create_user_profile()
        self.operator = create_staff()
        self.warehouse = create_warehouse()
        self.customer = create_customer(openid=self.warehouse.openid)

    def _auth_request(self, request) -> None:
        request.META["HTTP_OPERATOR"] = str(self.operator.id)
        force_authenticate(request, user=self.user, token=self.auth)

    def test_due_schedule_enqueues_and_runs_report_task(self) -> None:
        ScheduledTask.objects.create(
            warehouse=self.warehouse,
            name="daily-aging",
            task_type=BackgroundTaskType.GENERATE_OPERATIONAL_REPORT,
            next_run_at=timezone.now() - timezone.timedelta(minutes=1),
            payload={"report_type": OperationalReportType.INVENTORY_AGING},
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        created = enqueue_due_scheduled_tasks(now=timezone.now())
        self.assertEqual(created, 1)
        processed = run_background_tasks(worker_name="test-worker", limit=5, include_schedules=False)
        self.assertEqual(processed, 1)
        task = BackgroundTask.objects.get()
        self.assertEqual(task.status, BackgroundTaskStatus.SUCCEEDED)
        self.assertIsNotNone(task.report_export)

    def test_integration_job_failure_is_retried_then_dead(self) -> None:
        job = IntegrationJob.objects.create(
            warehouse=self.warehouse,
            system_type=IntegrationSystemType.ERP,
            integration_name="netsuite",
            job_type=IntegrationJobType.ERP_SYNC,
            direction=IntegrationDirection.IMPORT,
            request_payload={"force_fail": True},
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        task = BackgroundTask.objects.create(
            integration_job=job,
            warehouse=self.warehouse,
            task_type=BackgroundTaskType.PROCESS_INTEGRATION_JOB,
            max_attempts=2,
            available_at=timezone.now(),
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        run_background_tasks(worker_name="test-worker", limit=1, include_schedules=False)
        task.refresh_from_db()
        job.refresh_from_db()
        self.assertEqual(task.status, BackgroundTaskStatus.RETRY)
        self.assertEqual(job.status, IntegrationJobStatus.FAILED)
        task.available_at = timezone.now() - timezone.timedelta(seconds=1)
        task.save(update_fields=["available_at", "update_time"])
        run_background_tasks(worker_name="test-worker", limit=1, include_schedules=False)
        task.refresh_from_db()
        self.assertEqual(task.status, BackgroundTaskStatus.DEAD)

        retry_view = BackgroundTaskViewSet.as_view({"post": "retry"})
        retry_request = self.factory.post(f"/api/automation/background-tasks/{task.id}/retry/", {}, format="json")
        self._auth_request(retry_request)
        retry_response = retry_view(retry_request, pk=task.id)
        self.assertEqual(retry_response.status_code, 202)
        task.refresh_from_db()
        job.refresh_from_db()
        self.assertEqual(task.status, BackgroundTaskStatus.QUEUED)
        self.assertEqual(task.attempt_count, 0)
        self.assertEqual(job.status, IntegrationJobStatus.QUEUED)

    def test_run_now_endpoint_enqueues_invoice_task(self) -> None:
        BillingRateContract.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            contract_name="customer-extra-scan",
            charge_type=BillingChargeType.EXTRA_SCAN,
            unit_rate=Decimal("2.5000"),
            minimum_charge=Decimal("0.0000"),
            effective_from=date.today(),
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        BillingChargeEvent.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            charge_type=BillingChargeType.EXTRA_SCAN,
            event_date=date.today(),
            quantity=Decimal("2.0000"),
            unit_rate=Decimal("0.0000"),
            amount=Decimal("0.0000"),
            currency="USD",
            status=BillingChargeStatus.OPEN,
            source_module="scanner",
            source_record_type="ScanSession",
            source_record_id=99,
            reference_code="SCAN-99",
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        schedule = ScheduledTask.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            name="nightly-invoice",
            task_type=BackgroundTaskType.GENERATE_INVOICE,
            interval_minutes=1440,
            next_run_at=timezone.now() + timezone.timedelta(days=1),
            payload={
                "period_start": date.today().isoformat(),
                "period_end": date.today().isoformat(),
                "invoice_number": "INV-AUTO-001",
            },
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        view = ScheduledTaskViewSet.as_view({"post": "run_now"})
        request = self.factory.post(f"/api/automation/scheduled-tasks/{schedule.id}/run-now/", {}, format="json")
        self._auth_request(request)
        response = view(request, pk=schedule.id)
        self.assertEqual(response.status_code, 202)
        self.assertEqual(BackgroundTask.objects.count(), 1)
        run_background_tasks(worker_name="test-worker", limit=2, include_schedules=False)
        invoice = Invoice.objects.get(invoice_number="INV-AUTO-001")
        self.assertEqual(invoice.total_amount, Decimal("5.0000"))

    def test_due_schedule_runs_storage_accrual_and_finance_export(self) -> None:
        BillingRateContract.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            contract_name="storage-daily",
            charge_type=BillingChargeType.STORAGE_DAILY,
            unit_rate=Decimal("1.2500"),
            minimum_charge=Decimal("0.0000"),
            effective_from=date.today(),
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        ScheduledTask.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            name="daily-storage-accrual",
            task_type=BackgroundTaskType.GENERATE_STORAGE_ACCRUAL,
            next_run_at=timezone.now() - timezone.timedelta(minutes=1),
            payload={"accrual_date": date.today().isoformat()},
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        charge_event = BillingChargeEvent.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            charge_type=BillingChargeType.EXTRA_SCAN,
            event_date=date.today(),
            quantity=Decimal("1.0000"),
            unit_rate=Decimal("0.0000"),
            amount=Decimal("0.0000"),
            currency="USD",
            status=BillingChargeStatus.OPEN,
            source_module="scanner",
            source_record_type="ScanSession",
            source_record_id=101,
            reference_code="SCAN-101",
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        BillingRateContract.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            contract_name="extra-scan",
            charge_type=BillingChargeType.EXTRA_SCAN,
            unit_rate=Decimal("2.5000"),
            minimum_charge=Decimal("0.0000"),
            effective_from=date.today(),
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        invoice = Invoice.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            invoice_number="INV-FIN-001",
            period_start=date.today(),
            period_end=date.today(),
            status=InvoiceStatus.FINALIZED,
            subtotal_amount=Decimal("2.5000"),
            total_amount=Decimal("2.5000"),
            generated_by=self.operator.staff_name,
            finalized_by=self.operator.staff_name,
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        InvoiceFinanceApproval.objects.create(
            invoice=invoice,
            status=FinanceApprovalStatus.APPROVED,
            submitted_by=self.operator.staff_name,
            reviewed_by=self.operator.staff_name,
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        ScheduledTask.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            name="daily-finance-export",
            task_type=BackgroundTaskType.GENERATE_FINANCE_EXPORT,
            next_run_at=timezone.now() - timezone.timedelta(minutes=1),
            payload={"period_start": date.today().isoformat(), "period_end": date.today().isoformat()},
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )

        created = enqueue_due_scheduled_tasks(now=timezone.now())
        self.assertEqual(created, 2)
        processed = run_background_tasks(worker_name="billing-worker", limit=5, include_schedules=False)
        self.assertEqual(processed, 2)
        self.assertTrue(StorageAccrualRun.objects.filter(openid=self.warehouse.openid).exists())
        self.assertTrue(BackgroundTask.objects.filter(task_type=BackgroundTaskType.GENERATE_FINANCE_EXPORT, status=BackgroundTaskStatus.SUCCEEDED).exists())

    def test_run_background_tasks_records_heartbeat_and_dashboard(self) -> None:
        BackgroundTask.objects.create(
            warehouse=self.warehouse,
            task_type=BackgroundTaskType.GENERATE_OPERATIONAL_REPORT,
            available_at=timezone.now(),
            payload={"report_type": OperationalReportType.INVENTORY_AGING},
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        run_background_tasks(worker_name="ops-worker", limit=1, include_schedules=False)
        heartbeat = WorkerHeartbeat.objects.get(worker_name="ops-worker")
        self.assertEqual(heartbeat.processed_count, 1)
        dashboard_view = BackgroundTaskViewSet.as_view({"get": "dashboard"})
        dashboard_request = self.factory.get("/api/automation/background-tasks/dashboard/")
        self._auth_request(dashboard_request)
        dashboard_response = dashboard_view(dashboard_request)
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertIn("workers", dashboard_response.data)

    def test_dead_tasks_raise_automation_alerts(self) -> None:
        BackgroundTask.objects.create(
            warehouse=self.warehouse,
            task_type=BackgroundTaskType.PROCESS_INTEGRATION_JOB,
            status=BackgroundTaskStatus.DEAD,
            reference_code="JOB-DEAD-1",
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        evaluate_view = BackgroundTaskViewSet.as_view({"post": "evaluate_alerts"})
        evaluate_request = self.factory.post("/api/automation/background-tasks/evaluate-alerts/", {}, format="json")
        self._auth_request(evaluate_request)
        evaluate_response = evaluate_view(evaluate_request)
        self.assertEqual(evaluate_response.status_code, 200)
        self.assertTrue(
            AutomationAlert.objects.filter(
                openid=self.warehouse.openid,
                alert_type=AutomationAlertType.DEAD_TASK,
                status="OPEN",
            ).exists()
        )
        heartbeat_view = WorkerHeartbeatViewSet.as_view({"get": "list"})
        heartbeat_request = self.factory.get("/api/automation/worker-heartbeats/")
        self._auth_request(heartbeat_request)
        heartbeat_response = heartbeat_view(heartbeat_request)
        self.assertEqual(heartbeat_response.status_code, 200)
