---
name: backend
description: Best practices for Django/DRF backend development in DaChongWMS, covering architecture, API conventions, authentication and permissions, modeling and migrations, initialization, access management, operational domains (inbound, outbound, counting, transfers, returns), integrations, inventory, locations, catalog, reporting, scanner primitives, automation, caching, error handling, and testing. Aligns with modular domain-first design using DRF viewsets, service layers, explicit permissions, transaction-safe inventory ops, Redis async, PostgreSQL, and security from .codex/AGENTS.md.
---

# Backend Development

## Instructions

When working on backend code:

1. Follow the modular Django app structure: each domain (e.g., access, inventory, inbound) in its own app under `backend/<app>/` with `__init__.py`, `apps.py`, `models.py`, `serializers.py`, `services.py`, `views.py`, `urls.py`, `permissions.py`, `tests.py`.
2. Use DRF ViewSets for APIs with explicit URL maps per app; keep APIs thin, tenant-safe.
3. Place multi-model workflows in `services.py`, not serializers.
4. Scope to company/tenant via `CompanyMembership` and `utils.auth` resolver.
5. Wrap stock-changing flows with `transaction.atomic()`.
6. Use `django-filter` for structured filters, `OrderingFilter`, `SearchFilter`.
7. Default to `PageNumberPagination` (page_size=50).
8. Auth: Session + Token; permissions: `IsAuthenticatedOrReadOnly` base, override for roles (Manager, Supervisor, Inbound, etc.).
9. Migrations per app; review before commit; transitional for destructive changes.
10. Long-running jobs in `automation` app.
11. Validate via serializers; stamp operator names into audit fields.

## Examples

### App Layout Template

```
backend/
  <app_name>/
    __init__.py
    apps.py
    models.py
    serializers.py
    services.py  # Multi-model orchestration
    views.py     # DRF ViewSets
    urls.py
    permissions.py
    tests.py
```

### Model with Audit Fields & Constraints

```python
from django.db import models, transaction
from django.db.models import CheckConstraint, Q, UniqueConstraint

class InventoryItem(models.Model):
    sku = models.CharField(max_length=100, unique=True)
    warehouse = models.ForeignKey('locations.Warehouse', on_delete=models.PROTECT)
    available_qty = models.DecimalField(max_digits=10, decimal_places=2)
    allocated_qty = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey('staff.ListModel', on_delete=models.PROTECT, null=True)

    class Meta:
        constraints = [
            UniqueConstraint(fields=['sku', 'warehouse'], name='unique_sku_per_warehouse'),
            CheckConstraint(check=Q(available_qty__gte=0), name='non_negative_available'),
        ]

    @classmethod
    def available(cls):
        return cls.objects.filter(available_qty__gt=0)
```

### Service Layer for Inventory Adjustment

```python
# inventory/services.py
from django.db import transaction

@transaction.atomic
def adjust_inventory(item_id, delta_qty, reason, operator):
    item = InventoryItem.objects.select_for_update().get(id=item_id)
    item.available_qty += delta_qty
    item.save(update_fields=['available_qty', 'updated_at', 'updated_by'])
    # Emit audit log or event
    return item
```

### DRF ViewSet with Permissions & Filtering

```python
# inventory/views.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema
from django_filters.rest_framework import DjangoFilterBackend
from . import serializers, filters, permissions
from .services import adjust_inventory

class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all()
    serializer_class = serializers.InventoryItemSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_class = filters.InventoryItemFilter
    permission_classes = [IsAuthenticated, permissions.StockControlOrReadOnly]
    pagination_class = PageNumberPagination

    @extend_schema(description="Adjust available quantity")
    @action(detail=True, methods=['post'])
    def adjust(self, request, pk=None):
        # Validation in serializer/service
        item = self.get_object()
        delta = self.request.data['delta_qty']
        adjust_inventory(item.id, delta, request.data['reason'], request.operator)
        return Response(self.get_serializer(item).data)
```

### Custom Permission Class

```python
# permissions.py
from rest_framework.permissions import BasePermission
from utils.auth import get_membership

class StockControlOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        membership = get_membership(request)
        return membership.role in ['Manager', 'Supervisor', 'StockControl']
```

### URL Router

```python
# urls.py
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'inventory-items', views.InventoryItemViewSet)
urlpatterns = router.urls
```

## Best Practices

- **Layers:** Entry/Config → Apps → Services → API → Automation/Utilities.
- **API:** Plural nouns, shallow nesting, POST create 201, PATCH partial, pagination metadata, DRF exceptions for errors.
- **Auth/Perms:** Role gates (e.g., Manager/Supervisor for writes), MFA enrollment post-signup, company-scoped via membership.
- **Models/DB:** Timestamps/audit, explicit FK on_delete, constraints/indexes, managers for queries, SQLite dev/Postgres prod.
- **Migrations:** Per-app, review generated, backfill destructives.
- **Init/Deploy:** manage.py CLI, ASGI/WSGI entrypoints, env vars (DATABASE_URL, etc.), Docker stacks.
- **Transactions/Async:** Atomic for stock changes; automation app for jobs.
- **Schema/Docs:** DRF Spectacular /api/schema/ /api/docs/.
- **Security:** Operator stamping, no client-trust, Redis ACL/TLS, logs without secrets.
- **Testing:** Model constraints, managers, state transitions, inventory math.
- Align with .codex/AGENTS.md: Domain-first, transaction-safe, explicit auth, minimal changes.

## Domain-Specific

### Access & Membership
- Company tenants, memberships (user-company links), invites/resets, audit events, preferences (queue/workbench).
- APIs: /api/access/my-memberships/, company-switching without re-auth.
- Rules: Managers provision; self-service switch/activate.

### API Conventions
- GET list pagination, POST 201 full obj, PATCH partial.
- Filters/ordering/search via django-filter.
- Version /api/v1/ later.

### Auth & Permissions
- Session/Token; roles: Manager, Supervisor, Inbound/Outbound/StockControl.
- MFA: TOTP post-signup, challenges on login.
- Scanner/handheld: Auth staff operators.

### Models & Migrations
- Explicit entities (balances, history, holds).
- Constraints for invariants (non-neg qty).
- Linear migrations, fixtures for seeds.

### Django Init & Entry
- manage.py runserver dev; uvicorn ASGI prod.
- Settings central, env overrides.

### Inventory
- available/allocated qty, adjustments transaction-safe, race-proof select_for_update.

### Scanner
- Barcode aliases, LPN state, handheld sessions, telemetry, offline replay.
- Auth operators, task assignment validation.

### Operations (Inbound/Outbound/Counting/Transfers/Returns)
- Scan-first: ASN/LPN receive/putaway, dock outbound.
- Role-gated writes; approval queues for counting.

### Integrations & Reporting
- ERP/carrier/webhooks in integrations.
- KPIs, accruals, invoices, settlements (Finance role).

### Automation
- Queued/scheduled work, retries, alerts, workers.

### Other (Catalog/Locations/Caching/Error-Handling)
- Catalog: goods/brand/class/specs.
- Locations: Warehouse topology, locks.
- Redis caching/async; structured logging, DRF exceptions.

Converted from backend/ai/docs/ (23 files); expand sections as needed by referencing source docs.
