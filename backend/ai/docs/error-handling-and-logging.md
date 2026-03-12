# Error Handling and Logging

Accurate logging and predictable error responses keep DaChongWMS debuggable and auditable.

## Django Logging Config

- Defined in `settings.LOGGING`. Currently routes all messages through the root logger to stdout via `StreamHandler`.
- `level` defaults to `INFO` when `DEBUG=True`, otherwise `WARNING`. Adjust per environment if you need more granularity (e.g., debug logging in staging only).
- Extend with module-specific loggers (e.g., `"inventory": {"handlers": ["console"], "level": "INFO"}`) once apps ship domain logic.

## API Error Responses

- Raise DRF exceptions (`ValidationError`, `NotAuthenticated`, `PermissionDenied`, `NotFound`). They provide consistent JSON payloads and integrate with Spectacular docs.
- For unexpected errors, let Django/DRF propagate to the default handler so monitoring captures stack traces. Avoid catching exceptions unless you can add context or transform them into domain-specific errors.

## Structured Logging

- Include contextual fields such as `request_id`, `user_id`, `warehouse_id` when logging mutable inventory events.
- Consider adopting `structlog` or JSON logging once multiple services consume the logs.

## Monitoring & Alerts

- Pipe logs to the platform’s centralized logging stack (CloudWatch, Stackdriver, ELK, etc.).
- Establish alerting thresholds for:
  - HTTP 5xx spikes
  - Permission denials (potential abuse)
  - Inventory task failures

## Error Handling Patterns

- Wrap multi-step inventory adjustments in `transaction.atomic()` and raise `ValidationError` with actionable messages when invariants fail.
- Convert external integration failures into retriable background jobs instead of blocking user flows indefinitely.
- For background jobs, catch anticipated exceptions, log them with task metadata, and re-raise to trigger retries.

## Developer Workflow

- Use `python manage.py check` and automated tests to catch config errors early.
- Reproduce production issues locally by replaying logs or crafting fixtures that match failing scenarios.
