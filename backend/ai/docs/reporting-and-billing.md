# Reporting and Billing

Reporting is now split across two layers:

- `apps.reporting` is the first-class modular reporting app for warehouse KPI snapshots and operational CSV exports.
- Advanced invoice generation, storage-accrual billing, settlement/remittance, disputes, credit notes, external remittance ingestion, and the billing-event ledger still need a first-class modular rebuild.

Operational fee management now lives separately in `apps.fees`. That modular app owns recharge/deduction requests, vouchers, charge items/templates, manual charges, rent details, business expenses, receivable bills, fund flow, and profit snapshots.

The new `/statistics` frontend workbench currently reads directly from the modular inbound, outbound, returns, and inventory APIs. It is intentionally not backed by a separate modular `apps.statistics` service yet; it is still a read-only aggregation layer over those operational domains.

## First-Class Reporting Scope

- `WarehouseKpiSnapshot`: point-in-time warehouse metrics derived from operational tables.
- `OperationalReportExport`: stored CSV exports for inventory aging and throughput reporting.

## Not Yet Rebuilt In Reporting

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

## Modular Reporting Flow

1. Warehouse KPI generation snapshots first-class inventory, inbound, outbound, counting, and returns data into `WarehouseKpiSnapshot`.
2. Operational report generation exports first-class warehouse data into CSV artifacts stored in `OperationalReportExport`.
3. The `/statistics` frontend can read either those persisted reporting artifacts or the underlying operational APIs depending on the screen.

## Target Billing Flow

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

First-class modular reporting routes:

- `GET/POST /api/v1/organizations/{organization_id}/reporting/kpi-snapshots/`
- `GET /api/v1/organizations/{organization_id}/reporting/kpi-snapshots/{id}/`
- `GET/POST /api/v1/organizations/{organization_id}/reporting/report-exports/`
- `GET /api/v1/organizations/{organization_id}/reporting/report-exports/{id}/`
- `GET /api/v1/organizations/{organization_id}/reporting/report-exports/{id}/download/`

These deeper billing routes are intentionally not exposed from the supported modular runtime until they are rebuilt under first-class `apps.reporting` and `apps.fees` APIs.
