# Automation

`automation` is the current background execution layer for DaChongWMS. It is database-backed, tenant-scoped, and designed to keep integration work plus scheduled reporting and billing out of request-response paths while exposing worker health and alerting.

## Scope

- `ScheduledTask`: recurring definitions for KPI snapshots, operational reports, and invoice generation.
- `BackgroundTask`: queued work items with status, retry counters, backoff, result summaries, and links to integration jobs, report exports, or invoices.
- `WorkerHeartbeat`: worker liveness, queue depth, and last-run telemetry.
- `AutomationAlert`: tenant-scoped dead-letter, retry backlog, and stale-worker alerts.
- `run_background_worker`: management command that claims queued work, executes handlers, and applies retry or dead-letter state.

## Supported Task Types

- `PROCESS_INTEGRATION_JOB`: used for queued integration jobs and carrier work.
- `GENERATE_KPI_SNAPSHOT`: builds `reporting.WarehouseKpiSnapshot` records.
- `GENERATE_OPERATIONAL_REPORT`: builds `reporting.OperationalReportExport` CSV artifacts.
- `GENERATE_STORAGE_ACCRUAL`: builds `reporting.StorageAccrualRun` and its storage charge event.
- `GENERATE_INVOICE`: rates open `reporting.BillingChargeEvent` rows and creates invoices.
- `GENERATE_FINANCE_EXPORT`: builds `reporting.FinanceExport` CSV artifacts from finance-approved invoices.

Scheduled tasks intentionally support reporting and billing flows only. Integration jobs are still queued directly by `integrations` services rather than by recurring schedules.

## Retry Model

- Failed tasks move to `RETRY` until `max_attempts` is exhausted.
- Backoff is exponential from `retry_backoff_seconds`.
- Exhausted tasks move to `DEAD`.
- `POST /api/automation/background-tasks/{id}/retry/` manually requeues `DEAD` or `RETRY` tasks and resets linked integration state when relevant.

## Monitoring and Alerting

- `run_background_tasks()` records `WorkerHeartbeat` rows before and after each worker cycle.
- `evaluate_automation_alerts()` opens or refreshes alerts for:
  - dead background tasks
  - retry/running backlog older than the configured threshold
  - queued work without a fresh worker heartbeat
- `GET /api/automation/background-tasks/dashboard/` returns tenant queue metrics, recent alerts, and worker heartbeat summaries.
- `POST /api/automation/background-tasks/evaluate-alerts/` forces an alert evaluation cycle.

## API Surface

- `GET/POST /api/automation/scheduled-tasks/`
- `GET/PUT/PATCH/DELETE /api/automation/scheduled-tasks/{id}/`
- `POST /api/automation/scheduled-tasks/{id}/run-now/`
- `GET /api/automation/background-tasks/`
- `GET /api/automation/background-tasks/dashboard/`
- `POST /api/automation/background-tasks/evaluate-alerts/`
- `GET /api/automation/background-tasks/{id}/`
- `POST /api/automation/background-tasks/{id}/retry/`
- `GET /api/automation/worker-heartbeats/`
- `GET /api/automation/worker-heartbeats/{id}/`
- `GET /api/automation/alerts/`
- `GET /api/automation/alerts/{id}/`

## Operations Notes

- Worker process: `python manage.py run_background_worker --once` for one cycle, or omit `--once` for a long-running loop.
- Invoice schedules can provide either `payload.invoice_number` or `payload.invoice_prefix`; prefix mode generates a dated invoice number automatically.
- This DB-backed worker is the current standard. A broker-backed worker stack is still a future scale-out option, not a prerequisite for local or moderate-volume environments.
