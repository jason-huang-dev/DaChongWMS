# Auth and Permissions

Security is foundational for a warehouse management system. This document aligns authentication, authorization, and role planning across backend components.

## Authentication Stack

- **SessionAuthentication**: browser/admin debugging and admin access.
- **TokenAuthentication**: stateless API clients such as handheld scanners and future SPA/mobile clients.
- Future JWT or SSO providers should be added explicitly and documented here.

## Permissions Strategy

1. Default reads stay company-scoped through the active `CompanyMembership`.
2. Mutations require authentication and app-level role checks.
3. High-risk actions use dedicated permission classes plus service-layer validation.

## Current Role Gates

- `locations` topology writes require `Manager` or `Supervisor`.
- `locations` lock writes require `Manager`, `Supervisor`, or `StockControl`.
- `inventory` writes require `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- `inventory` config writes (`adjustment-reasons`, `adjustment-rules`) require `Manager`, `Supervisor`, or `StockControl`.
- `automation` schedule and retry writes require `Manager`, `Supervisor`, or `StockControl`.
- `automation` alert evaluation and monitoring writes use the same `Manager`, `Supervisor`, or `StockControl` gate; read surfaces remain authenticated and tenant-safe.
- `access` company-membership provisioning, invite issuance, password-reset issuance, and audit-feed reads require `Manager` or `Supervisor`; self-service membership reads and activation stay authenticated-only.
- `integrations` job, carrier-booking, and webhook-processing writes require `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`; raw webhook intake is authenticated but does not require `HTTP_OPERATOR`.
- `operations.inbound` writes require `Manager`, `Supervisor`, `Inbound`, or `StockControl`.
- `operations.outbound` writes require `Manager`, `Supervisor`, `Outbound`, or `StockControl`; short-pick resolution follows the same gate.
- `operations.counting` write endpoints require `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`; approval queue/export actions are further limited to `Manager`, `Supervisor`, or `StockControl`.
- `operations.transfers` writes require `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- `operations.returns` writes require `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- `reporting` KPI, operational export, rate-contract, storage-accrual, invoice, and billing-event writes require `Manager`, `Supervisor`, or `StockControl`.
- `reporting` finance review, settlement, remittance, dispute, credit-note, external-remittance-ingestion, and finance-export writes require `Finance`, `Manager`, or `Supervisor`.
- `scanner` handheld session, telemetry, and offline replay writes require `Inbound`, `Outbound`, `StockControl`, `Manager`, or `Supervisor`.

## Scanner-First Enforcement

- Inbound scan receive and outbound scan ship still require authenticated staff operators; they do not bypass standard role gates.
- Scan completion for putaway and pick also validates task assignment when a task is explicitly assigned.
- The current scan-first slice resolves direct SKU/location codes plus `scanner.BarcodeAlias` rows.
- LPN-based receive, putaway, pick, and ship flows now validate `scanner.LicensePlate` state.
- Device session lifecycle, telemetry, and offline replay now run through `/api/scanner/` and still require tenant-authenticated staff operators.

## Admin vs API

- Django admin uses the same auth backend and should be treated as a privileged surface.
- Mutation endpoints must stamp resolved operator names into audit fields rather than trusting client-supplied values.
- Tokens should map to real users or service identities so background and operational actions remain attributable.

## Company Membership Model

- The SPA token is the `userprofile.Users.token`, not the company `openid`.
- The active company comes from the selected `CompanyMembership`.
- `utils.auth` resolves the browser token into a membership and exposes:
  - `profile_token`
  - `membership_id`
  - `company_id`
  - `openid` for company/tenant scoping
- Browser users can switch companies through `/api/access/my-memberships/{id}/activate/` without re-authenticating.
- Legacy handheld-style flows still work because the resolved principal exposes the current company `openid` to downstream apps.
- Invite acceptance and password-reset completion intentionally bypass API auth and rely on signed random tokens instead.

## Signup and MFA

- Self-serve signup creates a Django auth user, a `userprofile.Users` row, and a matching `staff.ListModel` manager record.
- Signup and test-system bootstrap now also create the default `Company` and `CompanyMembership` records for the new browser identity.
- Signup now requires an email address and returns `mfa_enrollment_required=true` so the SPA can route the operator into TOTP enrollment immediately.
- Password login stays first-factor only until a verified MFA enrollment exists. Once a user has a verified enrollment, `POST /api/login/` returns `202` with an MFA challenge payload instead of issuing the normal tenant session payload.
- `POST /api/mfa/challenges/verify/` completes the login challenge with either a TOTP code or a one-time recovery code and then returns the normal auth payload.
- The SPA auth endpoints are token-style only; they do not establish a Django admin session. Admin access remains a separate `is_staff`/`is_superuser` login surface.
- Authenticated operators can manage their own MFA setup through:
  - `GET /api/mfa/status/`
  - `POST /api/mfa/enrollments/totp/`
  - `POST /api/mfa/enrollments/totp/verify/`

## MFA Hardening Still Needed

- secret rotation and enrollment revocation UX
- recovery-code regeneration with explicit confirmation
- step-up enforcement for privileged actions such as finance approvals and admin-level configuration writes
- optional policy gates that force MFA before allowing production access for selected roles or environments
