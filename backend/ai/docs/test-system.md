# Test-System Bootstrap

The current modular backend keeps a small developer bootstrap path for frontend work, but it no longer creates a brand new user and tenant on every click.

## Purpose

- Resolve a stable default development account for fast frontend iteration.
- Create the minimum workspace records only once if they do not exist yet.
- Return an authenticated session immediately so the frontend can enter the app without manual signup.

## Endpoint

- `POST /api/test-system/register/`

## Request Contract

- Accepts `POST /api/test-system/register/`.
- The current frontend sends an empty JSON body and the backend resolves the configured default development user.
- If the default user does not exist, the backend creates it once with these defaults unless overridden by environment variables:
  - email: `test-system-admin@example.com`
  - password: `TestSystem123!`
  - full name: `Test System Admin`
- If the user already exists, the endpoint logs that same user in again instead of creating another account.

## Seeded Records

- Global auth user
- One organization membership
- Owner role assignment
- One default warehouse
- One operator/staff profile linked to that membership

This is intentionally a lightweight developer workspace bootstrap, not a full demo-data seeder.

## Security

- This endpoint is for non-production bootstrap only.
- It is enabled when `DEBUG=True` or when `DJANGO_TEST_SYSTEM_ENABLED=true` is set in Django settings.
- Production environments should leave `TEST_SYSTEM_ENABLED` unset so the route returns `403`.

## Why This Stays Separate From Signup

- Real signup creates a new user and organization workspace.
- Test-system bootstrap reuses one stable dev account so frontend development stays fast and deterministic.
- Production registration and developer bootstrap should remain separate concerns.
