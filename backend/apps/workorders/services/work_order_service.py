from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from django.utils import timezone

from apps.organizations.models import Organization
from apps.partners.models import CustomerAccount
from apps.warehouse.models import Warehouse
from apps.workorders.models import WorkOrder, WorkOrderType

UNSET = object()


@dataclass(frozen=True, slots=True)
class CreateWorkOrderTypeInput:
    organization: Organization
    code: str
    name: str
    description: str = ""
    workstream: str = WorkOrderType.Workstream.GENERAL
    default_urgency: str = WorkOrderType.Urgency.MEDIUM
    default_priority_score: int = 50
    target_sla_hours: int = 24
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class CreateWorkOrderInput:
    organization: Organization
    work_order_type: WorkOrderType
    warehouse: Warehouse | None = None
    customer_account: CustomerAccount | None = None
    title: str = ""
    source_reference: str = ""
    status: str = WorkOrder.Status.PENDING_REVIEW
    urgency: str | None = None
    priority_score: int | None = None
    assignee_name: str = ""
    scheduled_start_at: datetime | None = None
    due_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    estimated_duration_minutes: int = 0
    notes: str = ""


def list_organization_work_order_types(*, organization: Organization) -> list[WorkOrderType]:
    return list(
        WorkOrderType.objects.filter(organization=organization).order_by("workstream", "name", "id")
    )


def create_work_order_type(payload: CreateWorkOrderTypeInput) -> WorkOrderType:
    work_order_type = WorkOrderType(
        organization=payload.organization,
        code=payload.code,
        name=payload.name,
        description=payload.description,
        workstream=payload.workstream,
        default_urgency=payload.default_urgency,
        default_priority_score=payload.default_priority_score,
        target_sla_hours=payload.target_sla_hours,
        is_active=payload.is_active,
    )
    work_order_type.save()
    return work_order_type


def update_work_order_type(
    work_order_type: WorkOrderType,
    *,
    code: str | None = None,
    name: str | None = None,
    description: str | None = None,
    workstream: str | None = None,
    default_urgency: str | None = None,
    default_priority_score: int | None = None,
    target_sla_hours: int | None = None,
    is_active: bool | None = None,
) -> WorkOrderType:
    if code is not None:
        work_order_type.code = code
    if name is not None:
        work_order_type.name = name
    if description is not None:
        work_order_type.description = description
    if workstream is not None:
        work_order_type.workstream = workstream
    if default_urgency is not None:
        work_order_type.default_urgency = default_urgency
    if default_priority_score is not None:
        work_order_type.default_priority_score = default_priority_score
    if target_sla_hours is not None:
        work_order_type.target_sla_hours = target_sla_hours
    if is_active is not None:
        work_order_type.is_active = is_active
    work_order_type.save()
    return work_order_type


def _resolve_due_at(
    *,
    work_order_type: WorkOrderType,
    scheduled_start_at: datetime | None,
    due_at: datetime | None,
) -> datetime | None:
    if due_at is not None:
        return due_at

    reference_time = scheduled_start_at or timezone.now()
    return reference_time + timedelta(hours=work_order_type.target_sla_hours)


def create_work_order(payload: CreateWorkOrderInput) -> WorkOrder:
    work_order = WorkOrder(
        organization=payload.organization,
        work_order_type=payload.work_order_type,
        warehouse=payload.warehouse,
        customer_account=payload.customer_account,
        title=payload.title,
        source_reference=payload.source_reference,
        status=payload.status,
        urgency=payload.urgency or payload.work_order_type.default_urgency,
        priority_score=payload.priority_score or payload.work_order_type.default_priority_score,
        assignee_name=payload.assignee_name,
        scheduled_start_at=payload.scheduled_start_at,
        due_at=_resolve_due_at(
            work_order_type=payload.work_order_type,
            scheduled_start_at=payload.scheduled_start_at,
            due_at=payload.due_at,
        ),
        started_at=payload.started_at,
        completed_at=payload.completed_at,
        estimated_duration_minutes=payload.estimated_duration_minutes,
        notes=payload.notes,
    )
    work_order.save()
    return work_order


def update_work_order(
    work_order: WorkOrder,
    *,
    work_order_type: WorkOrderType | None = None,
    warehouse: Warehouse | None | object = UNSET,
    customer_account: CustomerAccount | None | object = UNSET,
    title: str | None = None,
    source_reference: str | None = None,
    status: str | None = None,
    urgency: str | None = None,
    priority_score: int | None = None,
    assignee_name: str | None = None,
    scheduled_start_at: datetime | None | object = UNSET,
    due_at: datetime | None | object = UNSET,
    started_at: datetime | None | object = UNSET,
    completed_at: datetime | None | object = UNSET,
    estimated_duration_minutes: int | None = None,
    notes: str | None = None,
) -> WorkOrder:
    if work_order_type is not None:
        work_order.work_order_type = work_order_type
    if warehouse is not UNSET:
        work_order.warehouse = warehouse
    if customer_account is not UNSET:
        work_order.customer_account = customer_account
    if title is not None:
        work_order.title = title
    if source_reference is not None:
        work_order.source_reference = source_reference
    if status is not None:
        work_order.status = status
    if urgency is not None:
        work_order.urgency = urgency
    if priority_score is not None:
        work_order.priority_score = priority_score
    if assignee_name is not None:
        work_order.assignee_name = assignee_name
    if scheduled_start_at is not UNSET:
        work_order.scheduled_start_at = scheduled_start_at
    if due_at is not UNSET:
        work_order.due_at = due_at
    if started_at is not UNSET:
        work_order.started_at = started_at
    if completed_at is not UNSET:
        work_order.completed_at = completed_at
    if estimated_duration_minutes is not None:
        work_order.estimated_duration_minutes = estimated_duration_minutes
    if notes is not None:
        work_order.notes = notes

    if work_order.due_at is None:
        work_order.due_at = _resolve_due_at(
            work_order_type=work_order.work_order_type,
            scheduled_start_at=work_order.scheduled_start_at,
            due_at=None,
        )

    work_order.save()
    return work_order


def list_organization_work_orders(
    *,
    organization: Organization,
    warehouse: Warehouse | None = None,
) -> list[WorkOrder]:
    queryset = WorkOrder.objects.select_related(
        "work_order_type",
        "warehouse",
        "customer_account",
    ).filter(organization=organization)
    if warehouse is not None:
        queryset = queryset.filter(warehouse=warehouse)

    work_orders = list(queryset)
    closed_statuses = {WorkOrder.Status.COMPLETED, WorkOrder.Status.CANCELLED}
    urgency_order = {
        WorkOrderType.Urgency.CRITICAL: 0,
        WorkOrderType.Urgency.HIGH: 1,
        WorkOrderType.Urgency.MEDIUM: 2,
        WorkOrderType.Urgency.LOW: 3,
    }
    max_datetime = timezone.now() + timedelta(days=3650)
    ordered_work_orders = sorted(
        work_orders,
        key=lambda work_order: (
            1 if work_order.status in closed_statuses else 0,
            urgency_order.get(work_order.urgency, 99),
            -work_order.priority_score,
            work_order.due_at or max_datetime,
            work_order.scheduled_start_at or max_datetime,
            work_order.id,
        ),
    )
    for index, work_order in enumerate(ordered_work_orders, start=1):
        setattr(work_order, "fulfillment_rank", index)
    return ordered_work_orders
