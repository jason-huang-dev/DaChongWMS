# AGENTS.md

## Project Overview

DaChongWMS is a full-stack warehouse management system web application.

Current intended architecture:
- Backend: Django
- API layer: Django REST Framework
- Cache / async infrastructure: Redis
- Frontend: Vite + React + MUI

Prefer Django and DRF-native patterns on the backend, and React ecosystem best practices on the frontend.

## Primary Source of Truth

When making changes, consult these sources first:
- backend app structure and Django settings
- DRF serializers, views, routers, and permissions
- frontend feature structure under the React app
- `backend/ai/docs/*.md` for backend architecture, workflows, business logic, security, and API expectations
- `frontend/ai/docs/*.md` for frontend architecture, UI patterns, client state, and feature workflows

If there is a conflict:
1. actual backend/frontend code and config
2. database schema and migrations
3. backend/frontend AI docs

## Tech Stack Conventions

### Backend
- Use Django for domain logic, admin tooling, auth, and core app structure
- Use Django REST Framework for API endpoints
- Prefer service-oriented and app-oriented Django organization over putting all logic directly into views
- Keep business logic out of serializers when possible
- Use serializers for validation and transformation, not as the only domain layer
- Prefer explicit permissions and validation for inventory-sensitive operations

### Database
- Use PostgreSQL as the primary relational database
- Keep database changes in Django migrations
- Model inventory, locations, stock movements, orders, receipts, and adjustments explicitly
- Preserve data integrity with transactions where inventory counts are modified

### Cache and async work
- Redis is the intended cache layer
- Use Redis-backed workflows for caching and later background processing if needed
- When async jobs are introduced, prefer a Django-compatible task queue pattern
- Do not expose Redis directly to the public internet
- Use authenticated Redis users / ACLs and TLS in production

### Frontend
- Use Vite for the frontend toolchain
- Use React for UI
- Use MUI for component primitives and design consistency
- Use feature-oriented frontend structure where practical
- Prefer reusable components and typed API access patterns

## Project Structure Conventions

### Features
- Group related backend and frontend code by domain when practical
- Examples of feature areas:
  - inventory
  - products
  - warehouses
  - locations
  - inbound
  - outbound
  - transfers
  - cycle-counts
  - users / roles

### Documentation
- Document backend features in `backend/ai/docs`
- Document frontend features in `frontend/ai/docs`
- Use one markdown file per feature or domain area when practical
  - `backend/ai/docs/{featureName}.md`
  - `frontend/ai/docs/{featureName}.md`
- Feature docs should include:
  - business rules
  - user workflows
  - key API endpoints
  - validation rules
  - edge cases
  - security considerations for sensitive flows
- Update docs when feature behavior changes

## Backend Rules

### Django / DRF
- Use Django apps and DRF modules consistently
- Prefer DRF viewsets/routers for standard resource APIs
- Use APIViews only when a resource-oriented viewset is not a good fit
- Use serializers for request/response validation and shaping
- Keep business logic in services, managers, or domain functions when it grows beyond simple CRUD
- Use Django permissions / DRF permissions explicitly
- Validate all inventory-changing operations carefully

### API design
- Use predictable REST-style endpoints unless a workflow endpoint is clearly better
- Keep response shapes consistent
- Prefer explicit filtering, pagination, and search for list endpoints
- Design APIs with future frontend caching and invalidation in mind
- Keep external integration endpoints separate from internal app APIs when practical
- Apply authentication, authorization, and throttling intentionally to all endpoints

### Auth and permissions
- Use Django auth as the base
- Assume role-based access control will be needed
- Be strict about warehouse-sensitive actions such as stock changes, approvals, and adjustments
- Enforce object-level authorization, not just broad role checks
- Never assume that authentication alone is sufficient authorization

### Data integrity
- Inventory mutations must be transaction-safe
- Avoid race conditions on stock updates
- Prefer append-only movement/history records for traceability
- Never hide inventory-changing behavior in surprising places

## Frontend Rules

### React
- Use TypeScript
- Use feature-oriented structure
- Prefer hooks and composable state
- Keep server state separate from local UI state

### API access
- Centralize API calls
- Use typed request/response patterns where possible
- Keep auth handling, error handling, and invalidation consistent
- Do not trust the frontend as the authoritative validation layer

### UI
- Use MUI for base UI components
- Prefer accessible, data-dense interfaces suitable for WMS workflows
- Optimize for operational clarity over flashy design
- Tables, forms, filters, status chips, dialogs, and keyboard-friendly flows are important

## Security Rules

### General security principles
- Follow secure-by-default patterns
- Do not trust client-provided data
- Validate and authorize on the backend for every sensitive operation
- Use least privilege for users, services, background workers, and infrastructure
- Prefer simple, well-understood security controls over custom security mechanisms

### Django security
- Use Django’s built-in security features and middleware appropriately
- Keep `DEBUG = False` outside local development
- Restrict `ALLOWED_HOSTS`
- Use secure cookie settings in non-local environments
- Enable HTTPS-related protections in production, including HSTS and secure proxy settings where applicable
- Keep secrets out of source control and load them from environment variables or a secrets manager
- Avoid unsafe deserialization and unsafe dynamic code execution
- Keep dependencies and framework versions current and supported

### DRF / API security
- Require explicit authentication and permission rules on API endpoints
- Use object-level authorization for resource access
- Apply throttling to login, auth-adjacent, and abuse-prone endpoints
- Avoid overexposing model fields in serializers
- Do not return sensitive internal fields unless explicitly required
- Validate filtering, sorting, and search inputs
- Use pagination on list endpoints that can grow large
- Keep error responses useful but not overly revealing
- Separate internal operational APIs from third-party integration endpoints where practical

### Auth / session / token handling
- Prefer HttpOnly, Secure cookies for browser-based auth flows when feasible
- If token-based auth is used, store and rotate tokens carefully
- Do not store secrets or long-lived auth tokens in localStorage unless there is a strong reason and the risk is understood
- Protect login, password reset, and invitation flows carefully
- Require re-authorization or elevated checks for highly sensitive actions when appropriate

### Inventory and WMS-specific security
- Treat stock adjustments, transfers, approvals, receiving, and shipment confirmation as high-sensitivity operations
- Require explicit permission checks for every inventory-changing action
- Preserve an audit trail for critical state changes
- Log who performed sensitive actions and when
- Make reconciliation and traceability easier, not harder

### Redis / infrastructure security
- Never expose Redis directly to the public internet
- Use Redis authentication / ACLs
- Use TLS in production where supported
- Scope Redis access to the minimal required network paths
- Do not place secrets in logs, debug output, or client-visible config

### Frontend security
- Do not embed secrets in the frontend bundle
- Sanitize and validate user inputs through backend-backed rules
- Be careful with dangerously rendered HTML
- Do not rely on hidden UI controls as authorization
- Treat all client-side checks as UX only, not security

### Logging and observability
- Log security-relevant events such as login failures, permission denials, stock adjustments, and admin-sensitive actions
- Do not log passwords, tokens, secret keys, or raw sensitive payloads
- Prefer structured logs for auditability
- Keep enough detail for incident investigation without leaking secrets

## Operational Priorities

This is a WMS application, so optimize for:
- correctness
- auditability
- clarity
- role safety
- performance under operational workflows
- security

Prefer boring, reliable patterns over clever abstractions.

## Common Mistakes to Avoid

- Do not put too much business logic directly in DRF views
- Do not rely on the frontend for critical inventory validation
- Do not introduce inconsistent endpoint shapes
- Do not make inventory updates without transaction awareness
- Do not tightly couple MUI components to raw API responses without a transformation layer
- Do not skip docs updates when workflows change
- Do not expose sensitive operations without object-level authorization
- Do not treat Redis or internal services as implicitly trusted without network and auth controls

## Feature Development Workflow

When implementing or modifying a feature:
1. Read the relevant backend or frontend AI docs
2. Review related Django models, serializers, views, permissions, and services
3. Review the frontend feature code and current UI patterns
4. Identify business rules, data integrity requirements, and security requirements
5. Make minimal, targeted changes
6. Update docs if workflows, validation, endpoint behavior, or security assumptions changed

## Guidance for Codex

When working in this repository:
- Prefer minimal, focused changes
- Follow existing Django and React project conventions
- Preserve domain correctness over speed
- Treat inventory-changing flows as high-sensitivity logic
- Keep backend validation authoritative
- Keep UI consistent and operationally efficient
- Update backend/frontend AI docs when behavior changes
- Default to explicit authentication, authorization, validation, and auditability for sensitive flows