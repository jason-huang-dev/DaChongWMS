# Auth and Permissions

Security is foundational for a warehouse management system. This document aligns authentication, authorization, and role planning across backend components.

## Authentication Stack

- **SessionAuthentication**: Enables admin access and browser-based debugging during early development.
- **TokenAuthentication**: Supports stateless API clients (mobile scanners, future SPA auth). Tokens should be issued via DRF authtoken endpoints or a custom auth app.
- Future providers (JWT, SSO) should be added to `REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"]` explicitly and documented here.

## Permissions Strategy

1. **Global Default**: `IsAuthenticatedOrReadOnly`. Anonymous users can read public endpoints (if any); mutations require auth.
2. **Per-View Overrides**: High-risk endpoints (inventory adjustments, stock counts, approvals) must override `permission_classes` with custom implementations.
3. **Role-Based Access Control**: Plan for `Role`/`Permission` models or integrate with Django groups. Document role scopes in `./ai/docs` when defined.

## Current Role Gates

- `locations` topology writes (`Zone`, `LocationType`, `Location`) now require `HTTP_OPERATOR` and a staff role of `Manager` or `Supervisor`.
- `locations` lock writes require `HTTP_OPERATOR` and a staff role of `Manager`, `Supervisor`, or `StockControl`.
- `inventory` writes require `HTTP_OPERATOR` and a staff role of `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- Read-only inventory and location queries remain tenant-scoped but do not require an operator header.

## Custom Permissions

- Implement in `<app>/permissions.py` and keep logic small; offload heavy checks to services or domain modules to stay testable.
- Permission classes should log authorization failures at INFO level when helpful for audits.

## Admin vs API

- Django admin leverages the same auth backend. Configure staff/superuser roles carefully; never assume admin actions are low risk.
- API tokens should map to real users to preserve accountability.
- Mutation endpoints should stamp the resolved operator name into audit fields rather than trusting client-supplied creator values.

## Security Best Practices

- Enforce `CSRF_TRUSTED_ORIGINS` for browser clients behind load balancers.
- Require HTTPS everywhere once the project leaves local development.
- Rotate tokens/keys periodically; store them in secure secret managers in production environments.
- Audit logs for sensitive endpoints (stock change, order release) should include `request.user`, request metadata, and old/new state when feasible.
