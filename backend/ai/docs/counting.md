# Counting Operations

`operations.counting` owns cycle counts, blind-count handheld execution, scanner-first task/count capture, recount assignments, and the approval handoff into controlled inventory adjustments.

## Scope

- `CycleCount`: the warehouse-level count header and lifecycle state.
- `CycleCountLine`: the snapshot of a specific inventory balance at count creation time plus the counted quantity, handheld assignment, recount state, and variance.
- `CountApproval`: the approval record for a variance line when policy requires review before an adjustment can post.
- Scanner-first endpoints accept `location` and `sku` payloads and resolve the assigned line without exposing internal line IDs to handheld clients.
- Handheld task actions track explicit `ack`, `start`, and `complete` state on each assigned count or recount line.

## Workflow

1. Create a cycle count with one or more inventory balances.
2. Optionally mark the count as blind and assign lines to handheld operators.
3. Count each line and record the counted quantity plus an adjustment reason when there is a variance.
4. Rejected variances can be reassigned for recount without destroying the original count snapshot.
5. Handheld operators pull their work from `/api/counting/cycle-count-lines/my-assignments/`; blind counts suppress `system_qty` on that surface.
6. Handheld scanners can ask `/api/counting/cycle-count-lines/next-task/` for the next assigned open count or recount line; recount work is prioritized ahead of normal count work, and in-progress tasks stay ahead of untouched tasks.
7. Handheld clients can explicitly `ack`, `start`, and `complete` work through `/api/counting/cycle-count-lines/<id>/scanner-ack/`, `/scanner-start/`, and `/scanner-complete/`.
8. Handheld scanners can also resolve and post counts through `/api/counting/cycle-count-lines/scan-lookup/` and `/api/counting/cycle-count-lines/scan-count/` using scanned location and SKU values rather than generic PATCH calls.
9. Submit the cycle count.
10. Zero-variance lines reconcile immediately.
11. Variance lines either auto-apply an inventory adjustment or enter `PENDING_APPROVAL` based on the selected reason code and any matching approval rule.
12. Approval posts the adjustment movement; rejection marks the line and header as rejected so the warehouse can recount.

## Approval Rules

- Adjustment reason codes live in `inventory`.
- Rules can be global for the tenant or warehouse-specific.
- The highest matching threshold wins, with warehouse-specific rules taking precedence over global rules.
- If a reason requires approval but no explicit rule exists, the default approver role is `Manager`.

## Validation Rules

- Count lines snapshot `system_qty` when the count is created.
- Approval will refuse to post if the live inventory balance changed after the snapshot; a recount is required instead.
- Blind-count queues hide `system_qty` for assigned handheld users until the line is reconciled.
- Assigned lines can only be counted by the assignee unless a supervisor-style role overrides the assignment.
- Scanner-first count capture only resolves lines already assigned to the acting operator, which prevents handheld devices from mutating unrelated count work.
- Scanner task lifecycle fields (`scanner_task_status`, timestamps, last operator) are reset on reassignment and completed automatically when the count/recount is posted.
- Rejected variances must be explicitly assigned for recount before they can be recounted and resubmitted.
- Reconciled lines become immutable once an adjustment movement is posted.
- Pending approvals must be decided before a line can be edited again.

## Permissions

- General count writes require `HTTP_OPERATOR` and a staff role of `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- Approval and rejection actions are limited to `Manager`, `Supervisor`, or `StockControl`, and the service also enforces the rule's required role.
- Approval queue, dashboard, and summary reporting are also limited to `Manager`, `Supervisor`, or `StockControl`.
- The dashboard at `/api/counting/approvals/dashboard/` reports aging pending variances and overdue recount work based on configurable SLA hour thresholds.
- `/api/counting/approvals/dashboard/` and `/api/counting/approvals/dashboard/export/` both support narrowing by `warehouse=<id>` and `approver_role=<role>`.
- `/api/counting/approvals/dashboard/export/` streams the dashboard dataset as CSV and supports `scope=all|pending|recount` plus the same SLA hour query parameters.
