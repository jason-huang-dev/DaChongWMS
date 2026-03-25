# Access and Membership

The access surface is now implemented by first-class `apps.organizations` and `apps.accounts` code. It turns the browser-session shell into a real multi-organization workspace model.

## Scope

- `Organization`: tenant/workspace record
- `OrganizationMembership`: link between a global `accounts.User` and an organization
- `OrganizationInvite`: time-boxed invite token for a new browser user
- `OrganizationPasswordReset`: time-boxed password-reset token for an existing organization membership
- `OrganizationAccessAuditEvent`: append-only audit feed for membership, invite, reset, and workspace-switch actions
- `QueueViewPreference`: persisted queue filter/column/density preset for a membership
- `WorkspaceTabPreference`: persisted workspace-tab state for the authenticated operator
- `WorkbenchPreference`: persisted workbench time-window and widget-layout state

## Responsibilities

- keep one browser identity attached to multiple organizations
- stamp a default organization membership at signup/bootstrap time
- let managers and supervisors provision additional browser accounts for their organization
- let managers and supervisors issue invite tokens and password-reset tokens
- let authenticated users switch their active organization without re-entering credentials
- expose an access-audit feed for organization-admin review
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
- `company-memberships` is compatibility naming only; the backing records are organization-scoped memberships.
- Membership activation changes the active organization while keeping the same browser user/session token.
- The API token sent by the SPA is a first-class session token issued from `apps.accounts`; the active organization comes from the selected membership.
- Invite acceptance and password-reset completion are public token endpoints; they do not rely on an existing browser session.
- Invite and reset tokens are intentionally returned in API responses for now so warehouse admins can distribute them through their own communication channel until a mailer is added.
- Queue-view and workbench preferences are membership-owned, not organization-global; they follow the active browser identity within the selected organization.
- Workspace tabs are also membership-owned, which lets one operator keep separate multi-tab layouts across different organizations.

## Downstream Effects

- `apps.accounts.authentication.LegacyHeaderAuthentication` resolves the browser token into an organization membership before building the request principal.
- login and MFA bootstrap create or resolve a default organization membership.
- frontend workspace switching and access-management screens should treat memberships as the source of truth, not local-only workspace state.
