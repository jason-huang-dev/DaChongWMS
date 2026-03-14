# Background Jobs

DaChongWMS now runs background work through the `automation` app. The current implementation is database-backed and is used for integration execution, scheduled reporting, and scheduled billing.

## Current Stack

- Queue storage: `automation.BackgroundTask`
- Schedule storage: `automation.ScheduledTask`
- Worker health: `automation.WorkerHeartbeat`
- Alerting: `automation.AutomationAlert`
- Worker entrypoint: `python manage.py run_background_worker`
- Retry orchestration: automatic exponential backoff plus manual requeue for dead tasks

## What Runs Asynchronously

- integration jobs created by `integrations`
- carrier booking completion and carrier label generation
- scheduled KPI snapshot generation
- scheduled operational CSV report generation
- scheduled storage accrual generation
- scheduled invoice generation
- scheduled finance export generation

## Scheduling Rules

- Schedules are tenant-scoped.
- Supported recurring task types are KPI snapshots, reports, storage accruals, invoices, and finance exports.
- Invoice schedules require a customer plus `period_start`, `period_end`, and either `invoice_number` or `invoice_prefix` in `payload`.
- Storage accrual schedules require warehouse/customer scope and may provide `payload.accrual_date`.
- Finance export schedules require `payload.period_start` and `payload.period_end`.

## Retry Rules

- Failed tasks move to `RETRY` until `max_attempts` is exhausted.
- When retries are exhausted, tasks move to `DEAD`.
- Manual retry is available through `/api/automation/background-tasks/{id}/retry/`.
- Integration-linked retries also reset the linked integration job and webhook/carrier state as needed.

## Monitoring

- Every worker cycle writes a `WorkerHeartbeat` row with queue depth and processed count.
- Alert evaluation opens tenant-scoped alerts for dead tasks, retry backlog, and stale workers.
- Use `/api/automation/background-tasks/dashboard/` for queue health and `/api/automation/alerts/` for open alert inspection.

## When To Keep Work Synchronous

- single-record CRUD with short execution time
- inventory mutations that must confirm success in the same request
- approval actions where the user needs immediate final state

## Future Scale-Out

Redis/Celery or a similar broker-backed worker stack is still a valid future direction for higher throughput, parallelism, or cross-process scheduling. The current DB-backed worker is the supported baseline and now has heartbeat/alert instrumentation so the cutover decision can be made from observed backlog and failure data rather than assumption.
