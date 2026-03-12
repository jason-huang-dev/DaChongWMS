# API Conventions

APIs are delivered via Django REST Framework. Consistency prevents brittle frontend integrations and keeps Spectacular-generated docs accurate.

## URL Design

- Use plural resource names: `/api/inventory-items/`, `/api/warehouses/`.
- Nest resources only when relationships are tightly coupled (e.g., `/api/warehouses/{id}/locations/`).
- Reserve `/api/internal/` or `/api/integrations/` for external partner endpoints.

## HTTP Methods

- `GET`: Query + retrieve with pagination (default `PageNumberPagination`, page size 50, override via `page_size` param when needed).
- `POST`: Create resources. Validate on serializers; return 201 with full representation.
- `PUT/PATCH`: Update resources. PATCH preferred for partial updates.
- `DELETE`: Soft delete when domain requires history; expose explicit `archive` actions otherwise.

## Filtering, Ordering, Search

- `django-filter` handles structured filters. Define `FilterSet` classes per viewset when filters exceed a few fields.
- `ordering` param uses DRF OrderingFilter (e.g., `?ordering=-created_at`). Document allowed fields.
- `search` param is powered by `SearchFilter`; use for lightweight text search (e.g., SKU, reference numbers).

## Authentication & Permissions

- Default authentication classes come from settings: Session + Token. JWT or other schemes can be added later but must remain explicit.
- Permission defaults to `IsAuthenticatedOrReadOnly`. Override per viewset when stricter control (e.g., warehouse adjustments) is required.

## Response Shape

- Wrap list responses with pagination metadata (DRF default) to keep the frontend aligned.
- Use serializers for outbound data even on read-only endpoints to ensure schema coverage.
- Include hyperlink or identifier fields for relationships; avoid embedding entire related collections unless necessary.

## Schema & Docs

- Every viewset or APIView should either inherit `ExtendSchema` decorators or rely on serializer docstrings so Spectacular surface area stays descriptive.
- Validate new endpoints by inspecting `/api/schema/` (raw OpenAPI) and `/api/docs/` (Swagger UI) locally before merging.

## Versioning

- Keep a single API surface during early development. Once public endpoints stabilize, introduce `/api/v1/` namespace via router include.

## Error Handling

- Use DRF exceptions (`ValidationError`, `PermissionDenied`, etc.) to feed consistent JSON error bodies.
- For non-request errors (background jobs, integrations) log via `logging` module and surface status via monitoring rather than ad-hoc responses.
