"""Billing helpers kept separate from reporting exports to avoid import cycles."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from inventory.services import ensure_tenant_match

from .models import BillingChargeEvent, BillingChargeStatus


@dataclass(frozen=True)
class BillingChargePayload:
    warehouse: object
    customer: object | None
    charge_type: str
    event_date: object
    quantity: Decimal
    uom: str
    unit_rate: Decimal | None
    currency: str
    status: str | None
    source_module: str
    source_record_type: str
    source_record_id: int | None
    reference_code: str
    notes: str


def _amount(quantity: Decimal, unit_rate: Decimal) -> Decimal:
    return (quantity * unit_rate).quantize(Decimal("0.0001"))


@transaction.atomic
def record_charge_event(*, openid: str, operator_name: str, payload: BillingChargePayload) -> BillingChargeEvent:
    ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    if payload.customer is not None:
        ensure_tenant_match(payload.customer, openid, "Customer")
    unit_rate = payload.unit_rate if payload.unit_rate is not None else Decimal("0.0000")
    status = payload.status or BillingChargeStatus.OPEN
    if payload.quantity < Decimal("0.0000") or unit_rate < Decimal("0.0000"):
        raise ValidationError({"detail": "Quantity and unit rate must be zero or greater"})

    if payload.source_record_id is not None:
        existing = BillingChargeEvent.objects.filter(
            openid=openid,
            charge_type=payload.charge_type,
            source_module=payload.source_module,
            source_record_type=payload.source_record_type,
            source_record_id=payload.source_record_id,
            is_delete=False,
        ).first()
        if existing is not None:
            return existing

    return BillingChargeEvent.objects.create(
        warehouse=payload.warehouse,
        customer=payload.customer,
        charge_type=payload.charge_type,
        event_date=payload.event_date,
        quantity=payload.quantity,
        uom=payload.uom,
        unit_rate=unit_rate,
        amount=_amount(payload.quantity, unit_rate),
        currency=payload.currency,
        status=status,
        source_module=payload.source_module,
        source_record_type=payload.source_record_type,
        source_record_id=payload.source_record_id,
        reference_code=payload.reference_code,
        notes=payload.notes,
        creator=operator_name,
        openid=openid,
    )


@transaction.atomic
def upsert_charge_event(*, openid: str, operator_name: str, payload: BillingChargePayload) -> BillingChargeEvent:
    ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    if payload.customer is not None:
        ensure_tenant_match(payload.customer, openid, "Customer")
    unit_rate = payload.unit_rate if payload.unit_rate is not None else Decimal("0.0000")
    status = payload.status or BillingChargeStatus.OPEN
    if payload.source_record_id is None:
        return record_charge_event(openid=openid, operator_name=operator_name, payload=payload)

    existing = BillingChargeEvent.objects.select_for_update().filter(
        openid=openid,
        charge_type=payload.charge_type,
        source_module=payload.source_module,
        source_record_type=payload.source_record_type,
        source_record_id=payload.source_record_id,
        is_delete=False,
    ).first()
    if existing is None:
        return record_charge_event(openid=openid, operator_name=operator_name, payload=payload)

    if existing.status == BillingChargeStatus.INVOICED:
        return existing

    existing.warehouse = payload.warehouse
    existing.customer = payload.customer
    existing.event_date = payload.event_date
    existing.quantity = payload.quantity
    existing.uom = payload.uom
    existing.unit_rate = unit_rate
    existing.amount = _amount(payload.quantity, unit_rate)
    existing.currency = payload.currency
    existing.status = status
    existing.reference_code = payload.reference_code
    existing.notes = payload.notes
    existing.save(
        update_fields=[
            "warehouse",
            "customer",
            "event_date",
            "quantity",
            "uom",
            "unit_rate",
            "amount",
            "currency",
            "status",
            "reference_code",
            "notes",
            "update_time",
        ]
    )
    return existing


@transaction.atomic
def update_charge_event(
    *,
    openid: str,
    charge_event: BillingChargeEvent,
    quantity: Decimal,
    unit_rate: Decimal,
    status: str,
    notes: str,
) -> BillingChargeEvent:
    ensure_tenant_match(charge_event, openid, "Billing charge event")
    locked_event = BillingChargeEvent.objects.select_for_update().get(pk=charge_event.pk)
    if locked_event.status == BillingChargeStatus.INVOICED:
        raise ValidationError({"detail": "Invoiced charge events cannot be edited"})
    if locked_event.status == BillingChargeStatus.VOID and status != BillingChargeStatus.VOID:
        raise ValidationError({"detail": "Voided charge events cannot be re-opened"})
    locked_event.quantity = quantity
    locked_event.unit_rate = unit_rate
    locked_event.amount = _amount(quantity, unit_rate)
    locked_event.status = status
    locked_event.notes = notes
    locked_event.save(update_fields=["quantity", "unit_rate", "amount", "status", "notes", "update_time"])
    return locked_event
