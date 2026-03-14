"""Contract rating and invoice generation services."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from inventory.services import ensure_tenant_match

from .models import (
    BillingChargeEvent,
    BillingChargeStatus,
    BillingRateContract,
    Invoice,
    InvoiceFinanceApproval,
    InvoiceLine,
    FinanceApprovalStatus,
    InvoiceStatus,
)

ZERO = Decimal("0.0000")


@dataclass(frozen=True)
class InvoiceGenerationPayload:
    warehouse: object
    customer: object | None
    period_start: object
    period_end: object
    invoice_number: str
    notes: str = ""


@dataclass(frozen=True)
class InvoiceFinanceReviewPayload:
    notes: str = ""


@transaction.atomic

def resolve_rate_contract(*, openid: str, charge_event: BillingChargeEvent) -> BillingRateContract | None:
    ensure_tenant_match(charge_event, openid, "Billing charge event")
    queryset = BillingRateContract.objects.filter(
        openid=openid,
        warehouse=charge_event.warehouse,
        charge_type=charge_event.charge_type,
        is_delete=False,
        is_active=True,
        effective_from__lte=charge_event.event_date,
    ).filter(Q(effective_to__isnull=True) | Q(effective_to__gte=charge_event.event_date))
    if charge_event.customer_id is not None:
        exact = queryset.filter(customer_id=charge_event.customer_id).order_by("priority", "-effective_from", "id").first()
        if exact is not None:
            return exact
    return queryset.filter(customer__isnull=True).order_by("priority", "-effective_from", "id").first()


@transaction.atomic
def rate_charge_event(*, openid: str, operator_name: str, charge_event: BillingChargeEvent) -> BillingChargeEvent:
    ensure_tenant_match(charge_event, openid, "Billing charge event")
    locked_event = BillingChargeEvent.objects.select_for_update().get(pk=charge_event.pk)
    if locked_event.status == BillingChargeStatus.VOID:
        raise ValidationError({"detail": "Voided charge events cannot be rated"})
    contract = resolve_rate_contract(openid=openid, charge_event=locked_event)
    if contract is None:
        if locked_event.unit_rate > ZERO or locked_event.amount > ZERO:
            locked_event.rated_at = timezone.now()
            locked_event.rated_by = operator_name
            locked_event.save(update_fields=["rated_at", "rated_by", "update_time"])
            return locked_event
        raise ValidationError({"detail": f"No active rate contract found for charge type `{locked_event.charge_type}`"})

    amount = max(locked_event.quantity * contract.unit_rate, contract.minimum_charge).quantize(Decimal("0.0001"))
    locked_event.rate_contract = contract
    locked_event.unit_rate = contract.unit_rate
    locked_event.amount = amount
    locked_event.currency = contract.currency
    locked_event.uom = contract.uom
    locked_event.rated_at = timezone.now()
    locked_event.rated_by = operator_name
    locked_event.save(
        update_fields=[
            "rate_contract",
            "unit_rate",
            "amount",
            "currency",
            "uom",
            "rated_at",
            "rated_by",
            "update_time",
        ]
    )
    return locked_event


@transaction.atomic
def generate_invoice(*, openid: str, operator_name: str, payload: InvoiceGenerationPayload) -> Invoice:
    ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    if payload.customer is not None:
        ensure_tenant_match(payload.customer, openid, "Customer")
    if payload.period_start > payload.period_end:
        raise ValidationError({"detail": "period_start cannot be after period_end"})
    if not payload.invoice_number.strip():
        raise ValidationError({"detail": "invoice_number is required"})

    events = list(
        BillingChargeEvent.objects.select_for_update()
        .filter(
            openid=openid,
            warehouse=payload.warehouse,
            status=BillingChargeStatus.OPEN,
            is_delete=False,
            event_date__gte=payload.period_start,
            event_date__lte=payload.period_end,
        )
        .order_by("event_date", "id")
    )
    if payload.customer is not None:
        events = [event for event in events if event.customer_id == payload.customer.id]
    if not events:
        raise ValidationError({"detail": "No open billing charge events matched the selected invoice scope"})
    invoice_customer = payload.customer or events[0].customer
    if invoice_customer is None:
        raise ValidationError({"detail": "Invoices require customer-scoped billing charge events"})

    invoice = Invoice.objects.create(
        warehouse=payload.warehouse,
        customer=invoice_customer,
        invoice_number=payload.invoice_number,
        period_start=payload.period_start,
        period_end=payload.period_end,
        status=InvoiceStatus.DRAFT,
        currency="USD",
        generated_by=operator_name,
        notes=payload.notes,
        creator=operator_name,
        openid=openid,
    )
    subtotal = ZERO
    for event in events:
        rated_event = rate_charge_event(openid=openid, operator_name=operator_name, charge_event=event)
        InvoiceLine.objects.create(
            invoice=invoice,
            charge_event=rated_event,
            charge_type=rated_event.charge_type,
            event_date=rated_event.event_date,
            quantity=rated_event.quantity,
            uom=rated_event.uom,
            unit_rate=rated_event.unit_rate,
            amount=rated_event.amount,
            description=rated_event.notes or rated_event.charge_type,
            reference_code=rated_event.reference_code,
            creator=operator_name,
            openid=openid,
        )
        rated_event.status = BillingChargeStatus.INVOICED
        rated_event.save(update_fields=["status", "update_time"])
        subtotal += rated_event.amount

    invoice.subtotal_amount = subtotal
    invoice.tax_amount = ZERO
    invoice.total_amount = subtotal
    invoice.currency = invoice.lines.first().charge_event.currency if invoice.lines.exists() else "USD"
    invoice.save(update_fields=["subtotal_amount", "tax_amount", "total_amount", "currency", "update_time"])
    return invoice


@transaction.atomic
def finalize_invoice(*, openid: str, operator_name: str, invoice: Invoice, notes: str = "") -> Invoice:
    ensure_tenant_match(invoice, openid, "Invoice")
    locked_invoice = Invoice.objects.select_for_update().get(pk=invoice.pk)
    if locked_invoice.status == InvoiceStatus.VOID:
        raise ValidationError({"detail": "Voided invoices cannot be finalized"})
    locked_invoice.status = InvoiceStatus.FINALIZED
    locked_invoice.finalized_at = timezone.now()
    locked_invoice.finalized_by = operator_name
    if notes:
        locked_invoice.notes = notes
    locked_invoice.save(update_fields=["status", "finalized_at", "finalized_by", "notes", "update_time"])
    return locked_invoice


@transaction.atomic
def submit_invoice_for_finance_review(
    *,
    openid: str,
    operator_name: str,
    invoice: Invoice,
    payload: InvoiceFinanceReviewPayload,
) -> InvoiceFinanceApproval:
    ensure_tenant_match(invoice, openid, "Invoice")
    if invoice.status != InvoiceStatus.FINALIZED:
        raise ValidationError({"detail": "Only finalized invoices can be submitted for finance review"})
    review, _ = InvoiceFinanceApproval.objects.update_or_create(
        invoice=invoice,
        openid=openid,
        defaults={
            "status": FinanceApprovalStatus.PENDING,
            "submitted_at": timezone.now(),
            "submitted_by": operator_name,
            "reviewed_at": None,
            "reviewed_by": "",
            "notes": payload.notes,
            "creator": operator_name,
        },
    )
    return review


@transaction.atomic
def review_invoice_for_finance(
    *,
    openid: str,
    operator_name: str,
    invoice: Invoice,
    approve: bool,
    payload: InvoiceFinanceReviewPayload,
) -> InvoiceFinanceApproval:
    ensure_tenant_match(invoice, openid, "Invoice")
    try:
        review = InvoiceFinanceApproval.objects.select_for_update().get(invoice=invoice, openid=openid)
    except InvoiceFinanceApproval.DoesNotExist as exc:
        raise ValidationError({"detail": "Invoice has not been submitted for finance review"}) from exc
    review.status = FinanceApprovalStatus.APPROVED if approve else FinanceApprovalStatus.REJECTED
    review.reviewed_at = timezone.now()
    review.reviewed_by = operator_name
    if payload.notes:
        review.notes = payload.notes
    review.save(update_fields=["status", "reviewed_at", "reviewed_by", "notes", "update_time"])
    return review
