# Access and Membership

`access` owns company records and browser-user membership to those companies. It is the backend surface that turns the legacy single-tenant login shape into a real multi-company session model.

## Scope

- `Company`: tenant/workspace record with its own `openid`
- `CompanyMembership`: link between a Django auth user, a `userprofile.Users` record, a `staff.ListModel` row, and a company
- `CompanyInvite`: time-boxed invite token for a new browser user
- `CompanyPasswordReset`: time-boxed password-reset token for an existing company membership
- `AccessAuditEvent`: append-only audit feed for membership, invite, reset, and company-switch actions
- `QueueViewPreference`: persisted queue filter/column/density preset for a membership
- `WorkspaceTabPreference`: persisted workspace-tab state for the authenticated operator
- `WorkbenchPreference`: persisted workbench time-window and widget-layout state

## Responsibilities

- keep one browser identity attached to multiple companies
- stamp a default company membership at signup/bootstrap time
- let managers and supervisors provision additional browser accounts for their company
- let managers and supervisors issue invite tokens and password-reset tokens
- let authenticated users switch their active company without re-entering credentials
- expose an access-audit feed for company-admin review
- persist JF-style frontend state such as workspace tabs, queue views, and workbench widget choices

## API Surface

- `GET /api/access/my-memberships/`
- `GET /api/access/my-memberships/{id}/`
- `POST /api/access/my-memberships/{id}/activate/`
- `GET /api/access/company-memberships/`
- `POST /api/access/company-memberships/`
- `PATCH /api/access/company-memberships/{id}/`
- `GET /api/access/company-invites/`
- `POST /api/access/company-invites/`
- `POST /api/access/company-invites/{id}/revoke/`
- `POST /api/access/company-invites/accept/`
- `GET /api/access/password-resets/`
- `POST /api/access/password-resets/`
- `POST /api/access/password-resets/{id}/revoke/`
- `POST /api/access/password-resets/complete/`
- `GET /api/access/audit-events/`
- `GET /api/access/queue-view-preferences/`
- `POST /api/access/queue-view-preferences/`
- `PATCH /api/access/queue-view-preferences/{id}/`
- `DELETE /api/access/queue-view-preferences/{id}/`
- `GET /api/access/workspace-tabs/`
- `POST /api/access/workspace-tabs/sync/`
- `POST /api/access/workspace-tabs/{id}/activate/`
- `DELETE /api/access/workspace-tabs/{id}/`
- `GET /api/access/workbench-preferences/current/`
- `PATCH /api/access/workbench-preferences/current/`

## Behavioral Rules

- `my-memberships` is self-service and only returns memberships for the authenticated browser identity.
- `company-memberships` is company-scoped; managers and supervisors can provision or update browser accounts for their active company only.
- Membership activation changes the company `openid` used for tenant scoping while keeping the same browser user/session token.
- The API token sent by the SPA is now the `userprofile.Users.token`; the active company comes from the selected membership.
- Invite acceptance and password-reset completion are public token endpoints; they do not rely on an existing browser session.
- Invite and reset tokens are intentionally returned in API responses for now so warehouse admins can distribute them through their own communication channel until a mailer is added.
- Queue-view and workbench preferences are membership-owned, not company-global; they follow the active browser identity within the selected company.
- Workspace tabs are also membership-owned, which lets one operator keep separate multi-tab layouts across different companies.

## Downstream Effects

- `utils.auth` resolves the browser token into a company membership before building the request principal.
- login, MFA, and test-system bootstrap all create or resolve a default company membership.
- frontend company switching and access-management screens should treat memberships as the source of truth, not local-only workspace state.
