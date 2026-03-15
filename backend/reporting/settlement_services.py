"""Settlement, remittance, and dispute services for approved invoices."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from inventory.services import ensure_tenant_match

from .models import (
    CreditNote,
    CreditNoteStatus,
    ExternalRemittanceBatch,
    ExternalRemittanceBatchStatus,
    ExternalRemittanceItem,
    ExternalRemittanceItemStatus,
    FinanceApprovalStatus,
    Invoice,
    InvoiceDispute,
    InvoiceDisputeStatus,
    InvoiceLine,
    InvoiceRemittance,
    InvoiceRemittanceSource,
    InvoiceRemittanceStatus,
    InvoiceSettlement,
    InvoiceSettlementStatus,
    InvoiceStatus,
)

ZERO = Decimal("0.0000")


@dataclass(frozen=True)
class SettlementSubmissionPayload:
    requested_amount: Decimal
    due_date: date | None = None
    settlement_reference: str = ""
    notes: str = ""


@dataclass(frozen=True)
class SettlementReviewPayload:
    approved_amount: Decimal | None = None
    notes: str = ""


@dataclass(frozen=True)
class RemittancePayload:
    amount: Decimal
    remittance_reference: str
    remitted_at: datetime | None = None
    notes: str = ""
    source: str = InvoiceRemittanceSource.MANUAL
    external_reference: str = ""


@dataclass(frozen=True)
class DisputeSubmissionPayload:
    invoice_line: InvoiceLine | None
    reason_code: str
    disputed_amount: Decimal
    reference_code: str = ""
    notes: str = ""


@dataclass(frozen=True)
class DisputeReviewPayload:
    notes: str = ""


@dataclass(frozen=True)
class DisputeResolutionPayload:
    approved_credit_amount: Decimal = ZERO
    notes: str = ""


@dataclass(frozen=True)
class CreditNotePayload:
    credit_note_number: str
    amount: Decimal | None = None
    dispute: InvoiceDispute | None = None
    reason_code: str = "OTHER"
    reference_code: str = ""
    notes: str = ""


@dataclass(frozen=True)
class CreditNoteApplyPayload:
    notes: str = ""


@dataclass(frozen=True)
class ExternalRemittanceItemPayload:
    external_reference: str
    amount: Decimal
    currency: str = "USD"
    invoice_number: str = ""
    settlement_reference: str = ""
    remitted_at: datetime | None = None
    notes: str = ""
    payload: dict[str, object] | None = None


@dataclass(frozen=True)
class ExternalRemittanceBatchPayload:
    source_system: str
    external_batch_id: str
    items: list[ExternalRemittanceItemPayload]
    notes: str = ""
    payload: dict[str, object] | None = None


def _ensure_finance_ready(invoice: Invoice) -> None:
    if invoice.status != InvoiceStatus.FINALIZED:
        raise ValidationError({"detail": "Only finalized invoices can enter settlement workflow"})
    if not hasattr(invoice, "finance_approval") or invoice.finance_approval.status != FinanceApprovalStatus.APPROVED:
        raise ValidationError({"detail": "Invoice must have approved finance review before settlement"})


def _resolved_dispute_total(*, invoice: Invoice) -> Decimal:
    totals = invoice.disputes.filter(
        is_delete=False,
        status=InvoiceDisputeStatus.RESOLVED,
    ).aggregate(total=Sum("approved_credit_amount"))
    return totals["total"] or ZERO


def _issued_credit_note_total(*, invoice: Invoice) -> Decimal:
    totals = invoice.credit_notes.filter(
        is_delete=False,
        status__in=[CreditNoteStatus.ISSUED, CreditNoteStatus.APPLIED],
    ).aggregate(total=Sum("amount"))
    return totals["total"] or ZERO


def _has_open_disputes(*, invoice: Invoice) -> bool:
    return invoice.disputes.filter(
        is_delete=False,
        status__in=[InvoiceDisputeStatus.OPEN, InvoiceDisputeStatus.UNDER_REVIEW],
    ).exists()


def collectible_amount(*, invoice: Invoice) -> Decimal:
    issued_credit_total = _issued_credit_note_total(invoice=invoice)
    uncovered_dispute_total = ZERO
    for dispute in invoice.disputes.filter(is_delete=False, status=InvoiceDisputeStatus.RESOLVED):
        if not hasattr(dispute, "credit_note"):
            uncovered_dispute_total += dispute.approved_credit_amount
    return max(invoice.total_amount - issued_credit_total - uncovered_dispute_total, ZERO)


def _apply_settlement_status(settlement: InvoiceSettlement) -> InvoiceSettlement:
    if settlement.status == InvoiceSettlementStatus.REJECTED:
        return settlement
    if settlement.remitted_amount >= settlement.approved_amount > ZERO:
        settlement.status = InvoiceSettlementStatus.REMITTED
        settlement.completed_at = settlement.completed_at or timezone.now()
        return settlement
    if settlement.remitted_amount > ZERO:
        settlement.status = InvoiceSettlementStatus.PARTIALLY_REMITTED
        settlement.completed_at = None
        return settlement
    if settlement.approved_amount > ZERO:
        settlement.status = InvoiceSettlementStatus.APPROVED
        settlement.completed_at = None
        return settlement
    settlement.status = InvoiceSettlementStatus.PENDING_APPROVAL
    settlement.completed_at = None
    return settlement


def _adjust_settlement_after_finance_delta(*, settlement: InvoiceSettlement, invoice: Invoice) -> InvoiceSettlement:
    max_collectible = collectible_amount(invoice=invoice)
    if settlement.approved_amount > max_collectible:
        if settlement.remitted_amount > max_collectible:
            raise ValidationError({"detail": "Approved dispute would over-credit an invoice that already has remittance posted"})
        settlement.approved_amount = max_collectible
    _apply_settlement_status(settlement)
    settlement.save(update_fields=["approved_amount", "status", "completed_at", "update_time"])
    return settlement


@transaction.atomic
def submit_invoice_settlement(
    *,
    openid: str,
    operator_name: str,
    invoice: Invoice,
    payload: SettlementSubmissionPayload,
) -> InvoiceSettlement:
    ensure_tenant_match(invoice, openid, "Invoice")
    locked_invoice = Invoice.objects.select_for_update().select_related("finance_approval").get(pk=invoice.pk)
    _ensure_finance_ready(locked_invoice)
    if payload.requested_amount <= ZERO:
        raise ValidationError({"requested_amount": "requested_amount must be greater than zero"})

    max_collectible = collectible_amount(invoice=locked_invoice)
    if payload.requested_amount > max_collectible:
        raise ValidationError({"requested_amount": "requested_amount cannot exceed the collectible invoice amount"})

    settlement, _ = InvoiceSettlement.objects.select_for_update().update_or_create(
        invoice=locked_invoice,
        openid=openid,
        defaults={
            "status": InvoiceSettlementStatus.PENDING_APPROVAL,
            "requested_amount": payload.requested_amount,
            "approved_amount": ZERO,
            "currency": locked_invoice.currency,
            "due_date": payload.due_date,
            "settlement_reference": payload.settlement_reference,
            "submitted_at": timezone.now(),
            "submitted_by": operator_name,
            "reviewed_at": None,
            "reviewed_by": "",
            "notes": payload.notes,
            "creator": operator_name,
        },
    )
    if settlement.remitted_amount > ZERO:
        raise ValidationError({"detail": "Settlements with posted remittances cannot be resubmitted"})
    return settlement


@transaction.atomic
def review_invoice_settlement(
    *,
    openid: str,
    operator_name: str,
    invoice: Invoice,
    approve: bool,
    payload: SettlementReviewPayload,
) -> InvoiceSettlement:
    ensure_tenant_match(invoice, openid, "Invoice")
    locked_invoice = Invoice.objects.select_for_update().select_related("finance_approval").get(pk=invoice.pk)
    _ensure_finance_ready(locked_invoice)
    settlement = InvoiceSettlement.objects.select_for_update().get(invoice=locked_invoice, openid=openid)
    if approve and _has_open_disputes(invoice=locked_invoice):
        raise ValidationError({"detail": "Resolve open disputes before approving settlement"})

    settlement.reviewed_at = timezone.now()
    settlement.reviewed_by = operator_name
    if payload.notes:
        settlement.notes = payload.notes

    if approve:
        approved_amount = payload.approved_amount if payload.approved_amount is not None else settlement.requested_amount
        if approved_amount <= ZERO:
            raise ValidationError({"approved_amount": "approved_amount must be greater than zero"})
        max_collectible = collectible_amount(invoice=locked_invoice)
        if approved_amount > max_collectible:
            raise ValidationError({"approved_amount": "approved_amount cannot exceed the collectible invoice amount"})
        settlement.approved_amount = approved_amount
        settlement.status = InvoiceSettlementStatus.APPROVED
    else:
        settlement.approved_amount = ZERO
        settlement.status = InvoiceSettlementStatus.REJECTED
        settlement.completed_at = None

    settlement.save(update_fields=["approved_amount", "status", "reviewed_at", "reviewed_by", "notes", "completed_at", "update_time"])
    return settlement


@transaction.atomic
def record_invoice_remittance(
    *,
    openid: str,
    operator_name: str,
    settlement: InvoiceSettlement,
    payload: RemittancePayload,
) -> InvoiceRemittance:
    ensure_tenant_match(settlement, openid, "Invoice settlement")
    locked_settlement = InvoiceSettlement.objects.select_for_update().select_related("invoice", "invoice__finance_approval").get(pk=settlement.pk)
    _ensure_finance_ready(locked_settlement.invoice)
    if locked_settlement.status not in {InvoiceSettlementStatus.APPROVED, InvoiceSettlementStatus.PARTIALLY_REMITTED}:
        raise ValidationError({"detail": "Only approved settlements can receive remittance"})
    if _has_open_disputes(invoice=locked_settlement.invoice):
        raise ValidationError({"detail": "Resolve open disputes before posting remittance"})
    if payload.amount <= ZERO:
        raise ValidationError({"amount": "amount must be greater than zero"})
    if not payload.remittance_reference.strip():
        raise ValidationError({"remittance_reference": "remittance_reference is required"})

    max_collectible = collectible_amount(invoice=locked_settlement.invoice)
    remaining = min(locked_settlement.approved_amount, max_collectible) - locked_settlement.remitted_amount
    if payload.amount > remaining:
        raise ValidationError({"amount": "amount cannot exceed the remaining approved settlement amount"})

    remittance = InvoiceRemittance.objects.create(
        settlement=locked_settlement,
        status=InvoiceRemittanceStatus.POSTED,
        source=payload.source,
        remittance_reference=payload.remittance_reference,
        external_reference=payload.external_reference,
        remitted_at=payload.remitted_at or timezone.now(),
        remitted_by=operator_name,
        amount=payload.amount,
        currency=locked_settlement.currency,
        notes=payload.notes,
        creator=operator_name,
        openid=openid,
    )
    locked_settlement.remitted_amount += payload.amount
    _apply_settlement_status(locked_settlement)
    locked_settlement.save(update_fields=["remitted_amount", "status", "completed_at", "update_time"])
    return remittance


@transaction.atomic
def submit_invoice_dispute(
    *,
    openid: str,
    operator_name: str,
    invoice: Invoice,
    payload: DisputeSubmissionPayload,
) -> InvoiceDispute:
    ensure_tenant_match(invoice, openid, "Invoice")
    locked_invoice = Invoice.objects.select_for_update().select_related("finance_approval").get(pk=invoice.pk)
    _ensure_finance_ready(locked_invoice)
    if payload.invoice_line is not None:
        ensure_tenant_match(payload.invoice_line, openid, "Invoice line")
        if payload.invoice_line.invoice_id != locked_invoice.id:
            raise ValidationError({"invoice_line": "invoice_line must belong to the selected invoice"})
    if payload.disputed_amount <= ZERO:
        raise ValidationError({"disputed_amount": "disputed_amount must be greater than zero"})
    if payload.disputed_amount > collectible_amount(invoice=locked_invoice):
        raise ValidationError({"disputed_amount": "disputed_amount cannot exceed the collectible invoice amount"})

    return InvoiceDispute.objects.create(
        invoice=locked_invoice,
        invoice_line=payload.invoice_line,
        status=InvoiceDisputeStatus.OPEN,
        reason_code=payload.reason_code,
        reference_code=payload.reference_code,
        disputed_amount=payload.disputed_amount,
        opened_at=timezone.now(),
        opened_by=operator_name,
        notes=payload.notes,
        creator=operator_name,
        openid=openid,
    )


@transaction.atomic
def review_invoice_dispute(
    *,
    openid: str,
    operator_name: str,
    dispute: InvoiceDispute,
    payload: DisputeReviewPayload,
) -> InvoiceDispute:
    ensure_tenant_match(dispute, openid, "Invoice dispute")
    locked_dispute = InvoiceDispute.objects.select_for_update().select_related("invoice", "invoice__finance_approval").get(pk=dispute.pk)
    _ensure_finance_ready(locked_dispute.invoice)
    if locked_dispute.status not in {InvoiceDisputeStatus.OPEN, InvoiceDisputeStatus.UNDER_REVIEW}:
        raise ValidationError({"detail": "Only open disputes can be reviewed"})
    locked_dispute.status = InvoiceDisputeStatus.UNDER_REVIEW
    locked_dispute.reviewed_at = timezone.now()
    locked_dispute.reviewed_by = operator_name
    if payload.notes:
        locked_dispute.resolution_notes = payload.notes
    locked_dispute.save(update_fields=["status", "reviewed_at", "reviewed_by", "resolution_notes", "update_time"])
    return locked_dispute


@transaction.atomic
def resolve_invoice_dispute(
    *,
    openid: str,
    operator_name: str,
    dispute: InvoiceDispute,
    approve: bool,
    payload: DisputeResolutionPayload,
) -> InvoiceDispute:
    ensure_tenant_match(dispute, openid, "Invoice dispute")
    locked_dispute = InvoiceDispute.objects.select_for_update().select_related("invoice", "invoice__finance_approval").get(pk=dispute.pk)
    _ensure_finance_ready(locked_dispute.invoice)
    if locked_dispute.status not in {InvoiceDisputeStatus.OPEN, InvoiceDisputeStatus.UNDER_REVIEW}:
        raise ValidationError({"detail": "Only open disputes can be resolved"})

    locked_dispute.reviewed_at = locked_dispute.reviewed_at or timezone.now()
    locked_dispute.reviewed_by = locked_dispute.reviewed_by or operator_name
    locked_dispute.resolved_at = timezone.now()
    locked_dispute.resolved_by = operator_name
    if payload.notes:
        locked_dispute.resolution_notes = payload.notes

    if approve:
        if payload.approved_credit_amount < ZERO:
            raise ValidationError({"approved_credit_amount": "approved_credit_amount cannot be negative"})
        if payload.approved_credit_amount > locked_dispute.disputed_amount:
            raise ValidationError({"approved_credit_amount": "approved_credit_amount cannot exceed disputed_amount"})
        locked_dispute.approved_credit_amount = payload.approved_credit_amount
        locked_dispute.status = InvoiceDisputeStatus.RESOLVED
    else:
        locked_dispute.approved_credit_amount = ZERO
        locked_dispute.status = InvoiceDisputeStatus.REJECTED

    locked_dispute.save(
        update_fields=[
            "approved_credit_amount",
            "status",
            "reviewed_at",
            "reviewed_by",
            "resolved_at",
            "resolved_by",
            "resolution_notes",
            "update_time",
        ]
    )

    settlement = getattr(locked_dispute.invoice, "settlement", None)
    if settlement is not None and settlement.status != InvoiceSettlementStatus.REJECTED:
        _adjust_settlement_after_finance_delta(settlement=settlement, invoice=locked_dispute.invoice)
    return locked_dispute


@transaction.atomic
def issue_credit_note(
    *,
    openid: str,
    operator_name: str,
    invoice: Invoice,
    payload: CreditNotePayload,
) -> CreditNote:
    ensure_tenant_match(invoice, openid, "Invoice")
    locked_invoice = Invoice.objects.select_for_update().select_related("finance_approval").get(pk=invoice.pk)
    _ensure_finance_ready(locked_invoice)
    if not payload.credit_note_number.strip():
        raise ValidationError({"credit_note_number": "credit_note_number is required"})

    dispute = payload.dispute
    if dispute is not None:
        ensure_tenant_match(dispute, openid, "Invoice dispute")
        if dispute.invoice_id != locked_invoice.id:
            raise ValidationError({"dispute": "dispute must belong to the selected invoice"})
        if dispute.status != InvoiceDisputeStatus.RESOLVED:
            raise ValidationError({"dispute": "credit notes require a resolved dispute"})
        if hasattr(dispute, "credit_note"):
            raise ValidationError({"dispute": "A credit note already exists for this dispute"})

    amount = payload.amount if payload.amount is not None else (dispute.approved_credit_amount if dispute is not None else None)
    if amount is None:
        raise ValidationError({"amount": "amount is required when no dispute is provided"})
    if amount <= ZERO:
        raise ValidationError({"amount": "amount must be greater than zero"})
    if amount > collectible_amount(invoice=locked_invoice):
        raise ValidationError({"amount": "amount cannot exceed the collectible invoice amount"})
    if dispute is not None and amount > dispute.approved_credit_amount:
        raise ValidationError({"amount": "amount cannot exceed the resolved dispute credit amount"})

    credit_note = CreditNote.objects.create(
        invoice=locked_invoice,
        dispute=dispute,
        credit_note_number=payload.credit_note_number,
        status=CreditNoteStatus.ISSUED,
        reason_code=payload.reason_code if dispute is None else dispute.reason_code,
        amount=amount,
        currency=locked_invoice.currency,
        reference_code=payload.reference_code,
        issued_at=timezone.now(),
        issued_by=operator_name,
        notes=payload.notes,
        creator=operator_name,
        openid=openid,
    )
    settlement = getattr(locked_invoice, "settlement", None)
    if settlement is not None and settlement.status != InvoiceSettlementStatus.REJECTED:
        _adjust_settlement_after_finance_delta(settlement=settlement, invoice=locked_invoice)
    return credit_note


@transaction.atomic
def apply_credit_note(
    *,
    openid: str,
    operator_name: str,
    credit_note: CreditNote,
    payload: CreditNoteApplyPayload,
) -> CreditNote:
    ensure_tenant_match(credit_note, openid, "Credit note")
    locked_note = CreditNote.objects.select_for_update().select_related("invoice", "invoice__finance_approval").get(pk=credit_note.pk)
    _ensure_finance_ready(locked_note.invoice)
    if locked_note.status == CreditNoteStatus.VOID:
        raise ValidationError({"detail": "Voided credit notes cannot be applied"})
    locked_note.status = CreditNoteStatus.APPLIED
    locked_note.applied_at = timezone.now()
    locked_note.applied_by = operator_name
    if payload.notes:
        locked_note.notes = payload.notes
    locked_note.save(update_fields=["status", "applied_at", "applied_by", "notes", "update_time"])
    return locked_note


def _set_external_batch_status(*, applied_count: int, conflict_count: int, failed_count: int) -> str:
    if failed_count == 0 and conflict_count == 0:
        return ExternalRemittanceBatchStatus.COMPLETED
    if applied_count == 0 and failed_count > 0 and conflict_count == 0:
        return ExternalRemittanceBatchStatus.FAILED
    return ExternalRemittanceBatchStatus.PARTIAL


def _resolve_settlement_for_external_item(*, openid: str, item: ExternalRemittanceItemPayload) -> InvoiceSettlement:
    if item.settlement_reference:
        settlement = (
            InvoiceSettlement.objects.filter(
                openid=openid,
                settlement_reference=item.settlement_reference,
                is_delete=False,
            )
            .select_related("invoice", "invoice__finance_approval")
            .first()
        )
        if settlement is None:
            raise ValidationError({"detail": f"Settlement `{item.settlement_reference}` was not found"})
        return settlement
    if not item.invoice_number:
        raise ValidationError({"detail": "invoice_number or settlement_reference is required for external remittance ingestion"})
    invoice = (
        Invoice.objects.filter(openid=openid, invoice_number=item.invoice_number, is_delete=False)
        .select_related("finance_approval", "settlement")
        .first()
    )
    if invoice is None:
        raise ValidationError({"detail": f"Invoice `{item.invoice_number}` was not found"})
    settlement = getattr(invoice, "settlement", None)
    if settlement is None:
        raise ValidationError({"detail": f"Invoice `{item.invoice_number}` does not have a settlement"})
    return settlement


@transaction.atomic
def ingest_external_remittance_batch(
    *,
    openid: str,
    operator_name: str,
    payload: ExternalRemittanceBatchPayload,
) -> ExternalRemittanceBatch:
    if not payload.source_system.strip():
        raise ValidationError({"source_system": "source_system is required"})
    if not payload.external_batch_id.strip():
        raise ValidationError({"external_batch_id": "external_batch_id is required"})
    if not payload.items:
        raise ValidationError({"items": "At least one remittance item is required"})

    batch, created = ExternalRemittanceBatch.objects.select_for_update().get_or_create(
        openid=openid,
        source_system=payload.source_system,
        external_batch_id=payload.external_batch_id,
        is_delete=False,
        defaults={
            "status": ExternalRemittanceBatchStatus.PENDING,
            "payload": payload.payload or {},
            "notes": payload.notes,
            "creator": operator_name,
        },
    )
    if not created:
        return batch

    applied_count = 0
    conflict_count = 0
    failed_count = 0
    last_error = ""

    for item_payload in payload.items:
        item = ExternalRemittanceItem.objects.create(
            batch=batch,
            external_reference=item_payload.external_reference,
            matched_invoice_number=item_payload.invoice_number,
            matched_settlement_reference=item_payload.settlement_reference,
            amount=item_payload.amount,
            currency=item_payload.currency,
            status=ExternalRemittanceItemStatus.APPLIED,
            payload=item_payload.payload or {},
            creator=operator_name,
            openid=openid,
        )
        existing_remittance = InvoiceRemittance.objects.filter(
            openid=openid,
            remittance_reference=item_payload.external_reference,
            is_delete=False,
        ).select_related("settlement", "settlement__invoice").first()
        if existing_remittance is not None:
            item.invoice = existing_remittance.settlement.invoice
            item.settlement = existing_remittance.settlement
            item.remittance = existing_remittance
            item.status = ExternalRemittanceItemStatus.SKIPPED
            item.processed_at = timezone.now()
            item.save(update_fields=["invoice", "settlement", "remittance", "status", "processed_at", "update_time"])
            continue

        try:
            settlement = _resolve_settlement_for_external_item(openid=openid, item=item_payload)
            remittance = record_invoice_remittance(
                openid=openid,
                operator_name=operator_name,
                settlement=settlement,
                payload=RemittancePayload(
                    amount=item_payload.amount,
                    remittance_reference=item_payload.external_reference,
                    remitted_at=item_payload.remitted_at,
                    notes=item_payload.notes,
                    source=InvoiceRemittanceSource.EXTERNAL,
                    external_reference=item_payload.external_reference,
                ),
            )
        except ValidationError as exc:
            conflict_count += 1
            last_error = str(exc.detail if hasattr(exc, "detail") else exc)
            item.status = ExternalRemittanceItemStatus.CONFLICT
            item.processed_at = timezone.now()
            item.error_message = last_error
            item.save(update_fields=["status", "processed_at", "error_message", "update_time"])
            continue
        except Exception as exc:  # noqa: BLE001 - preserve raw ingestion failures on the item row
            failed_count += 1
            last_error = str(exc)
            item.status = ExternalRemittanceItemStatus.FAILED
            item.processed_at = timezone.now()
            item.error_message = str(exc)
            item.save(update_fields=["status", "processed_at", "error_message", "update_time"])
            continue

        applied_count += 1
        item.invoice = settlement.invoice
        item.settlement = settlement
        item.remittance = remittance
        item.status = ExternalRemittanceItemStatus.APPLIED
        item.processed_at = timezone.now()
        item.save(update_fields=["invoice", "settlement", "remittance", "status", "processed_at", "update_time"])

    batch.status = _set_external_batch_status(applied_count=applied_count, conflict_count=conflict_count, failed_count=failed_count)
    batch.processed_at = timezone.now()
    batch.item_count = len(payload.items)
    batch.applied_count = applied_count
    batch.conflict_count = conflict_count
    batch.failed_count = failed_count
    batch.last_error = last_error
    batch.save(
        update_fields=[
            "status",
            "processed_at",
            "item_count",
            "applied_count",
            "conflict_count",
            "failed_count",
            "last_error",
            "update_time",
        ]
    )
    return batch
