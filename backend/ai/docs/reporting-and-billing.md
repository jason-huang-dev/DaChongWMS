# Reporting and Billing

`reporting` packages warehouse KPIs, operational CSV exports, storage accruals, contract rating, invoice generation, finance review, settlement/remittance, disputes, credit notes, external remittance ingestion, and the billing-event ledger.

Operational fee management now lives separately in `apps.fees`. That modular app owns recharge/deduction requests, vouchers, charge items/templates, manual charges, rent details, business expenses, receivable bills, fund flow, and profit snapshots. `reporting` remains the invoice-centric legacy domain.

The new `/statistics` frontend workbench currently reads directly from the operational inbound, outbound, returns, and inventory APIs. It is intentionally not backed by a separate modular `apps.statistics` service yet, because the core execution models still live in the legacy operational domains.

## Scope

- `WarehouseKpiSnapshot`: point-in-time warehouse metrics derived from operational tables.
- `OperationalReportExport`: stored CSV exports for inventory aging and throughput reporting.
- `BillingChargeEvent`: billable operational events.
- `BillingRateContract`: pricing rules by warehouse, customer, charge type, and effective dates.
- `Invoice` / `InvoiceLine`: rated billing documents generated from open charge events.
- `StorageAccrualRun`: daily on-hand snapshot used to create storage billing events.
- `InvoiceFinanceApproval`: finance review state for finalized invoices.
- `InvoiceSettlement`: approved collection target and remaining remit balance for a finance-approved invoice.
- `InvoiceRemittance`: posted payment/remittance records against a settlement.
- `InvoiceDispute`: finance dispute workflow for invoice- or line-level issues.
- `CreditNote`: finance-issued credit document tied to a dispute or manual adjustment.
- `ExternalRemittanceBatch` / `ExternalRemittanceItem`: idempotent ingestion log for ERP or bank remittance payloads.
- `FinanceExport`: finance-facing CSV extract of approved invoices.

## Billing Flow

1. Warehouse execution creates or updates open `BillingChargeEvent` rows.
2. Rate contracts define the price for each charge type.
3. Storage accrual generation snapshots on-hand inventory and writes a `STORAGE_DAILY` charge event.
4. Invoice generation resolves the applicable contract, rates each open event, marks it invoiced, and creates invoice lines.
5. Finalization closes the invoice header for downstream finance handling.
6. Finance review submits, approves, or rejects finalized invoices.
7. Settlement submission and approval convert finance-approved invoices into collectible balances.
8. Remittances post against approved settlements and drive partial vs full settlement status.
9. Disputes can hold or reduce collectible balance through review and resolution.
10. Credit notes document approved credits and feed collectible-balance calculations.
11. External remittance ingestion can apply ERP or bank remittances onto approved settlements with conflict logging.
12. Finance export produces CSV extracts from finance-approved invoices with settlement, remittance, credit-note, and dispute totals.

## Scheduled Billing

- Scheduled storage accruals, invoice generation, and finance exports run through `automation`.
- Invoice schedules require a customer plus `period_start`, `period_end`, and either `invoice_number` or `invoice_prefix`.
- `invoice_prefix` mode is preferred for recurring schedules because it generates a dated invoice number automatically.
- Storage accrual schedules require warehouse/customer scope and may provide `payload.accrual_date`.
- Finance export schedules require `period_start` and `period_end`.

## Exports and KPIs

- KPI snapshot coverage: on-hand, available, allocated, hold, open purchasing/outbound work, pending count approvals, pending returns.
- Report types: `INVENTORY_AGING`, `RECEIVING_THROUGHPUT`, `SHIPPING_THROUGHPUT`.
- Export artifacts are stored in the database and downloadable through the API.

## API Surface

- `GET/POST /api/reporting/kpi-snapshots/`
- `GET /api/reporting/kpi-snapshots/{id}/`
- `GET/POST /api/reporting/report-exports/`
- `GET /api/reporting/report-exports/{id}/`
- `GET /api/reporting/report-exports/{id}/download/`
- `GET/POST /api/reporting/billing-charge-events/`
- `GET/PUT/PATCH /api/reporting/billing-charge-events/{id}/`
- `GET/POST /api/reporting/rate-contracts/`
- `GET/PUT/PATCH /api/reporting/rate-contracts/{id}/`
- `GET/POST /api/reporting/storage-accrual-runs/`
- `GET /api/reporting/storage-accrual-runs/{id}/`
- `GET/POST /api/reporting/invoices/`
- `GET /api/reporting/invoices/{id}/`
- `POST /api/reporting/invoices/{id}/finalize/`
- `POST /api/reporting/invoices/{id}/submit-finance-review/`
- `POST /api/reporting/invoices/{id}/approve-finance-review/`
- `POST /api/reporting/invoices/{id}/reject-finance-review/`
- `GET/POST /api/reporting/invoice-settlements/`
- `GET /api/reporting/invoice-settlements/{id}/`
- `POST /api/reporting/invoice-settlements/{id}/approve/`
- `POST /api/reporting/invoice-settlements/{id}/reject/`
- `GET/POST /api/reporting/invoice-remittances/`
- `GET /api/reporting/invoice-remittances/{id}/`
- `GET/POST /api/reporting/invoice-disputes/`
- `GET /api/reporting/invoice-disputes/{id}/`
- `POST /api/reporting/invoice-disputes/{id}/review/`
- `POST /api/reporting/invoice-disputes/{id}/resolve/`
- `POST /api/reporting/invoice-disputes/{id}/reject/`
- `GET/POST /api/reporting/credit-notes/`
- `GET /api/reporting/credit-notes/{id}/`
- `POST /api/reporting/credit-notes/{id}/apply/`
- `GET/POST /api/reporting/external-remittance-batches/`
- `GET /api/reporting/external-remittance-batches/{id}/`
- `GET/POST /api/reporting/finance-exports/`
- `GET /api/reporting/finance-exports/{id}/`
- `GET /api/reporting/finance-exports/{id}/download/`
