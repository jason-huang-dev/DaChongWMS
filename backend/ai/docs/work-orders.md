# Work Orders

`apps.workorders` is the modular scheduling slice for warehouse execution prioritization.

## Purpose

Use work orders when the business needs an operator-visible fulfillment queue that answers:

- which orders should be fulfilled first
- how urgent each item is
- which warehouse or client account the work belongs to
- what SLA or due time the team is working against

This is intentionally separate from raw inbound/outbound order models. A work order is the scheduling and execution layer above those source documents.

## Core models

### `WorkOrderType`

Reusable scheduling template owned by an organization:

- `code`
- `name`
- `description`
- `workstream`
- `default_urgency`
- `default_priority_score`
- `target_sla_hours`
- `is_active`

Typical examples:

- `dropship-rush`
- `returns-inspection`
- `inventory-recount`
- `priority-putaway`

### `WorkOrder`

Scheduled queue item owned by an organization:

- `work_order_type`
- optional `warehouse`
- optional `customer_account`
- `title`
- optional `source_reference`
- `status`
- `urgency`
- `priority_score`
- optional `assignee_name`
- optional `scheduled_start_at`
- optional `due_at`
- optional `started_at`
- optional `completed_at`
- `estimated_duration_minutes`
- `notes`

## Ordering strategy

The list API returns work orders ranked for fulfillment:

1. open work before completed/cancelled work
2. higher urgency before lower urgency
3. higher priority score before lower priority score
4. earlier due time before later due time
5. earlier scheduled start before later scheduled start

Each list response includes `fulfillment_rank` and `sla_status` so the frontend can visualize execution order without re-implementing scheduling logic.

## Permission model

The app introduces:

- `workorders.view_workorder`
- `workorders.manage_work_order_types`
- `workorders.manage_work_orders`

Default role intent:

- `OWNER`: full access
- `MANAGER`: manage types and work orders
- `STAFF`: view and manage work orders
- client roles: no work-order permissions by default

## API surface

- `GET/POST /api/v1/organizations/<organization_id>/work-order-types/`
- `GET/PATCH /api/v1/organizations/<organization_id>/work-order-types/<work_order_type_id>/`
- `GET/POST /api/v1/organizations/<organization_id>/work-orders/`
- `GET/PATCH /api/v1/organizations/<organization_id>/work-orders/<work_order_id>/`

`GET /work-orders/` accepts `warehouse_id` so workbenches can stay warehouse-scoped.
