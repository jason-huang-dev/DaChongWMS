# Test-System Bootstrap

The legacy GreaterWMS `userregister` module was not just a user-registration flow. It created a developer tenant, logged that user in, and seeded a large set of demo data so the rest of the stack could be exercised quickly. In this repo that behavior belongs in `test_system`, not in a production-facing auth app.

## Purpose

- Create a backend-authenticated test tenant plus a small but connected demo dataset.
- Prove that auth, tenant scoping, topology, catalog, partner, scanner, and inventory tables can all be written end to end.
- Provide a deterministic smoke-test path for local development, QA, and container validation.

## Endpoint

- `POST /api/test-system/register/`

## Request Contract

- Accepts the same basic credential shape as the legacy module: `name`, `password1`, `password2`.
- Missing credentials fall back to defaults so an empty JSON body can bootstrap a working test tenant:
  - username: `test-system-admin`
  - password: `TestSystem123!`
- Duplicate usernames return the legacy FBMsg error payload with an HTTP `409`.

## Seeded Records

- Django auth user + `userprofile.Users` tenant profile.
- Primary `staff` operator with the current repo's effective admin role: `Manager`.
- One warehouse, four zones, four location types, five locations, and one active quarantine lock.
- Catalog vocabulary rows plus three seeded SKUs under the grouped `catalog/` package.
- Suppliers, customers, capital records, transportation fees, and scanner entries for both locations and goods.
- Inventory opening balances, a transfer into the pick face, and an active hold so the balance, movement, and hold tables all receive data.
- Media directories under `MEDIA_ROOT/<openid>/{win32,linux,darwin}` created after the database transaction commits.

## Security

- This endpoint is for non-production bootstrap only.
- It is enabled when `DEBUG=True` or when `TEST_SYSTEM_ENABLED=True` is set in Django settings.
- Production environments should leave `TEST_SYSTEM_ENABLED` unset so the route returns `403`.

## Why This Is Not `userregister`

- The legacy module mixed authentication, tenant creation, filesystem setup, and demo data seeding in one flow.
- Production registration and smoke-test/bootstrap concerns should stay separate.
- `test_system` keeps the useful smoke-test behavior while avoiding the implication that end users should self-register this way.
