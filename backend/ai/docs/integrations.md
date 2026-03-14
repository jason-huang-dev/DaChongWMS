# Integrations

`integrations` owns the backend-side integration control plane. It records ERP sync jobs, carrier booking/label activity, webhook intake, and the integration log trail that ties those flows together.

## Scope

- `IntegrationJob`: tenant-scoped job headers for ERP syncs, carrier booking/label work, stock exports, shipment exports, and webhook processing.
- `WebhookEvent`: idempotent inbound event capture keyed by `(source_system, event_key)` within a tenant.
- `IntegrationLog`: append-only audit trail attached to a job and/or webhook event.
- `CarrierBooking`: shipment-facing carrier booking records with queued booking and label work.

## Async Execution Model

- Creating an integration job automatically enqueues an `automation.BackgroundTask`.
- Carrier booking and label generation are queued, not completed inline.
- Background worker failures update the integration job plus webhook/carrier state and can be retried through `automation`.

## Workflow

1. Queue an integration job.
2. `automation` claims the queued work and calls the integration execution service.
3. Success or failure is written back to `IntegrationJob`, `IntegrationLog`, and linked webhook/carrier records.
4. Dead tasks can be requeued manually when operations want controlled replay.

## Validation Rules

- All warehouse, shipment, and webhook references remain tenant-scoped.
- Carrier bookings must use the same warehouse as the linked shipment.
- Webhook intake is idempotent per active `(openid, source_system, event_key)` tuple.
- Finalized jobs (`SUCCEEDED`, `CANCELLED`) cannot be restarted through the manual job endpoints.
- Cancelled carrier bookings cannot generate labels.

## API Surface

- `GET/POST /api/integrations/jobs/`
- `GET /api/integrations/jobs/{id}/`
- `POST /api/integrations/jobs/{id}/start/`
- `POST /api/integrations/jobs/{id}/complete/`
- `POST /api/integrations/jobs/{id}/fail/`
- `GET/POST /api/integrations/webhooks/`
- `GET /api/integrations/webhooks/{id}/`
- `POST /api/integrations/webhooks/{id}/process/`
- `GET /api/integrations/logs/`
- `GET /api/integrations/logs/{id}/`
- `GET/POST /api/integrations/carrier-bookings/`
- `GET /api/integrations/carrier-bookings/{id}/`
- `POST /api/integrations/carrier-bookings/{id}/generate-label/`
