# Auth and Permissions

Security is foundational for a warehouse management system. This document aligns authentication, authorization, and role planning across backend components.

## Authentication Stack

- **SessionAuthentication**: browser/admin debugging and admin access.
- **TokenAuthentication**: stateless API clients such as handheld scanners and future SPA/mobile clients.
- Future JWT or SSO providers should be added explicitly and documented here.

## Permissions Strategy

1. Default reads stay tenant-scoped.
2. Mutations require authentication and app-level role checks.
3. High-risk actions use dedicated permission classes plus service-layer validation.

## Current Role Gates

- `locations` topology writes require `Manager` or `Supervisor`.
- `locations` lock writes require `Manager`, `Supervisor`, or `StockControl`.
- `inventory` writes require `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- `inventory` config writes (`adjustment-reasons`, `adjustment-rules`) require `Manager`, `Supervisor`, or `StockControl`.
- `automation` schedule and retry writes require `Manager`, `Supervisor`, or `StockControl`.
- `automation` alert evaluation and monitoring writes use the same `Manager`, `Supervisor`, or `StockControl` gate; read surfaces remain authenticated and tenant-safe.
- `integrations` job, carrier-booking, and webhook-processing writes require `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`; raw webhook intake is authenticated but does not require `HTTP_OPERATOR`.
- `operations.inbound` writes require `Manager`, `Supervisor`, `Inbound`, or `StockControl`.
- `operations.outbound` writes require `Manager`, `Supervisor`, `Outbound`, or `StockControl`.
- `operations.counting` write endpoints require `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`; approval queue/export actions are further limited to `Manager`, `Supervisor`, or `StockControl`.
- `operations.transfers` writes require `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- `operations.returns` writes require `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- `reporting` KPI, operational export, rate-contract, storage-accrual, invoice, and billing-event writes require `Manager`, `Supervisor`, or `StockControl`.
- `reporting` finance review and finance-export writes require `Finance`, `Manager`, or `Supervisor`.

## Scanner-First Enforcement

- Inbound scan receive and outbound scan ship still require authenticated staff operators; they do not bypass standard role gates.
- Scan completion for putaway and pick also validates task assignment when a task is explicitly assigned.
- The current scan-first slice resolves direct SKU/location codes plus `scanner.BarcodeAlias` rows.
- LPN-based receive, putaway, pick, and ship flows now validate `scanner.LicensePlate` state.
- Device sessions and offline replay are still future work.

## Admin vs API

- Django admin uses the same auth backend and should be treated as a privileged surface.
- Mutation endpoints must stamp resolved operator names into audit fields rather than trusting client-supplied values.
- Tokens should map to real users or service identities so background and operational actions remain attributable.
