# Fees

`apps.fees` is the modular operational finance domain for organization-scoped fee management.

## Scope

- `BalanceTransaction`: recharge and deduction requests plus review/posting state
- `Voucher`: recharge, deduction, credit, and adjustment vouchers
- `ChargeItem`: reusable fee-item catalog
- `ChargeTemplate`: reusable charging presets by warehouse and/or customer account
- `ManualCharge`: ad hoc charge capture outside automated billing runs
- `FundFlow`: inbound and outbound cash movement tied to fee events
- `RentDetail`: warehouse rent accrual detail
- `BusinessExpense`: internal expense ledger
- `ReceivableBill`: customer-facing receivable bills
- `ProfitCalculation`: revenue/expense snapshot for profitability review

## Design notes

- Every record is organization-scoped.
- Optional warehouse scope is supported where the fee record is operationally warehouse-specific.
- Optional customer-account scope is supported where the fee record is customer-facing.
- Cross-organization foreign-key references are rejected in model validation.
- Numeric derived fields are computed centrally in the model layer:
  - manual-charge amount
  - receivable-bill total
  - profit amount and margin

## API surface

All endpoints are organization-scoped under `/api/v1/organizations/{organization_id}/fees/`.

- `balance-transactions/`
- `vouchers/`
- `charge-items/`
- `charge-templates/`
- `manual-charges/`
- `fund-flows/`
- `rent-details/`
- `business-expenses/`
- `receivable-bills/`
- `profit-calculations/`

Each surface currently supports:

- `GET` list
- `POST` create
- `GET` detail
- `PATCH` update

## Permission model

- `fees.view_fees`
- `fees.manage_balance_transactions`
- `fees.review_balance_transactions`
- `fees.manage_vouchers`
- `fees.manage_charge_catalog`
- `fees.manage_manual_charges`
- `fees.manage_fund_flows`
- `fees.manage_rent_details`
- `fees.manage_business_expenses`
- `fees.manage_receivable_bills`
- `fees.manage_profit_calculations`

## Relationship to legacy reporting

`apps.fees` is the operator-facing fees workbench domain.

Legacy `backend/reporting` remains invoice-centric and still owns:

- invoice generation
- settlement and remittance
- disputes
- finance exports
- KPI/report exports

The current frontend routes therefore split responsibilities:

- `/finance`: operational fees workbench backed by `apps.fees`
- `/finance/invoices/:invoiceId`: legacy invoice detail backed by `reporting`
