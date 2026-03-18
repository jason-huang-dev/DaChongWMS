# Forms and Validation

The first frontend form layer is now in place and follows the documented RHF + Zod pattern.

## Current Implementation

- Feature validators now live under `features/<domain>/model/validators.ts`.
- Routed forms now live under `features/<domain>/view/` and consume controller hooks instead of owning HTTP calls directly.
- `frontend/src/features/auth/view/LoginPage.tsx` uses React Hook Form and Zod for login validation.
- `frontend/src/features/auth/view/SignupPage.tsx` uses React Hook Form and Zod for manager-account signup validation.
- `frontend/src/features/mfa/view/MfaChallengePage.tsx` and `frontend/src/features/mfa/view/MfaEnrollmentPage.tsx` use React Hook Form and Zod for MFA verification and enrollment.
- `frontend/src/shared/components/form-text-field.tsx` wraps MUI `TextField` with RHF `Controller` integration.
- `frontend/src/shared/components/form-autocomplete.tsx`, `frontend/src/shared/components/reference-autocomplete-field.tsx`, and `frontend/src/shared/components/form-switch-field.tsx` now cover repeated selector and boolean inputs.
- `frontend/src/shared/components/data-view-toolbar.tsx` now acts as the dense queue-filter band for enterprise pages and supports compact date inputs in addition to text/select fields.
- Scan-first mutation forms now exist for receive, putaway, pick, ship, and assigned count completion, each using feature-local validators and controller actions.
- Detail/action forms now exist for purchase-order edits, sales-order edits, transfer-order edits, return-order edits, count-approval decisions, invoice finance actions, and selector-driven create flows for receipts, shipments, transfer orders, return orders, return receipts, and return dispositions through `view/*Form.tsx` or route-local view components.
- Access-management forms now exist for tenant staff directory maintenance, role assignment, verification-code control, and lock-state management.
- Repeated header-field layouts are shared through `frontend/src/shared/components/document-header-fields.tsx` instead of duplicating the same date/reference/notes markup in each detail screen.

## MVC Rule

- validation schemas belong in `model/validators.ts`
- submit and mutation orchestration belong in `controller/`
- MUI field layout belongs in `view/`
- views must not call backend APIs directly

## Current Rules

- Login requires both `name` and `password`.
- Signup currently requires `name`, `email`, `password1`, and `password2`.
- MFA challenge currently requires a TOTP code or recovery code string.
- MFA enrollment currently requires a label for the authenticator entry plus a valid TOTP code to verify the generated secret.
- Backend errors are surfaced through the shared API error parser.
- Submit buttons are disabled while requests are in flight.
- The developer bootstrap path is isolated behind `VITE_ENABLE_TEST_SYSTEM`.
- Signup collects email now so MFA enrollment and account recovery can be added without replacing the current account model.
- MFA recovery codes are rendered once after successful TOTP verification and should be copied before leaving the screen.
- Detail views only expose fields the backend already allows operators to patch directly; reference-data changes stay server-owned until selector flows are added.
- Security forms must surface backend gaps explicitly. The current backend can manage staff directory records, but admin-created browser login accounts still need a dedicated provisioning API.

## UX Baseline

- Forms use stacked fields with inline helper/error text.
- Submit actions show a spinner while the mutation is running.
- Backend failure messages are displayed in a single alert near the top of the form.
- Success messages are shown inline after scan or detail-page actions complete.
- JSON-backed backend fields are edited as validated text areas and parsed centrally through `frontend/src/shared/utils/json.ts`.
- Large lookup fields are debounced and page forward through shared reference hooks instead of assuming the first response page contains every valid option.

## Next Form Work

- Add field-level mapping for DRF validation objects on create/update flows.
- Add richer handheld affordances such as barcode-focused autofocus, hotkey submit, and scanner-specific validation copy.
- Add richer create/edit flows for finance, counting, and remaining admin domains using the same selector-based form pattern.

## JF-Inspired Queue Filter Forms

The next form surface is not only create/edit flows. JF-style operational queues require a reusable filter-form system that can express:

- search-by selector + search value
- enum and reference-data dropdowns
- date range windows
- numeric min/max ranges
- boolean/interception/reshipment toggles
- warehouse/client/platform/logistics selectors

Rules for implementation:

- advanced queue filters should still be modeled with RHF + Zod when the filter density or validation complexity is non-trivial
- shared filter schemas belong in `model/validators.ts` when a queue has canonical filter shapes
- reset/apply/save-view behavior belongs in controller hooks, not in field components
- filter rows should support compact enterprise density without losing helper/error behavior

The first implementation slice is active now on outbound:

- status buckets live beside the main queue instead of inside the table only
- date-window filters sit inside the shared dense filter band
- queue state can now be paired with persisted workspace tabs and workbench preferences from the backend

Scanner-first work is still important, but the next large form investment should be advanced filter composition for queue pages.
