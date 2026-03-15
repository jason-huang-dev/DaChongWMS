# Backend Architecture

DaChongWMS uses Django and Django REST Framework (DRF) to deliver a modular, domain-first backend. This document captures the layered approach so future apps align with the same structure.

## High-Level Layers

1. **Entry + Configuration**: `dachong_wms.settings`, `asgi.py`, and `wsgi.py`.
2. **Django Apps**: Each domain lives in its own app inside `backend/`. Shared domain groupings such as `catalog.*` and `operations.*` are preferred when several apps belong to the same bounded context.
3. **Service Layer**: Multi-model workflow stays in service modules, not serializers.
4. **API Layer**: DRF viewsets and explicit URL maps per app.
5. **Automation Layer**: `automation` owns queued work, recurring schedules, retry state, worker heartbeats, alerting, and the worker command for async execution.
6. **Utility Layer**: shared helpers under `backend/utils/` for auth, operator resolution, pagination, validation, and scan-code resolution.
7. **Bootstrap Services**: `test_system` seeds a usable tenant for smoke tests.
8. **Operational Domains**: `operations.inbound`, `operations.outbound`, `operations.counting`, `operations.transfers`, and `operations.returns` own warehouse execution.
9. **Integration + Commercial Domains**: `integrations` owns ERP/carrier/webhook control flow. `reporting` owns KPIs, storage accruals, finance review/export, rate contracts, invoices, settlements, remittances, disputes, credit notes, external remittance ingestion, and billing charge events.
10. **Scan Primitives**: `scanner` holds barcode aliases, scan rules, LPN state, handheld device sessions, telemetry, and offline replay used by the operational apps.

## Current State

- DRF Spectacular is wired under `/api/schema/` and `/api/docs/`.
- `automation` is now installed and exposed under `/api/automation/`.
- Scan-first execution now includes ASN/LPN-aware inbound receive/putaway, dock-verified outbound shipping, and scanner-managed handheld session/offline replay.

## App Layout Template

```
backend/
  <app_name>/
    __init__.py
    apps.py
    models.py
    serializers.py
    services.py
    views.py
    urls.py
    permissions.py
    tests.py
```

- Keep migrations inside each app.
- Keep domain orchestration in services.
- Keep APIs thin and tenant-safe.

## Cross-Cutting Concerns

- **Authentication**: Django auth + token auth.
- **Auditing**: stamp resolved operator names into workflow records.
- **Transactions**: wrap stock-changing flows and background handlers with `transaction.atomic()`.
- **Async Boundaries**: long-running integrations and scheduled commercial/reporting jobs belong in `automation`, not HTTP requests.

## Future Enhancements

- broker-backed workers for horizontal scale
- metrics/health endpoints for worker backlog and failure rate
- shared core mixins if repeated model/view scaffolding grows further
