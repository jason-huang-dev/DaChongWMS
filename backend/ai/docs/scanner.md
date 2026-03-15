# Scanner Module

`scanner` now owns the barcode registry, handheld session APIs, offline replay, and the Y2 scan primitives used by inbound and outbound workflows.

## Model Overview

| Field | Purpose |
| --- | --- |
| `mode` | Logical workflow or entity class (for example `GOODS`, `ASN`, `DN`). |
| `code` | Human-readable identifier. |
| `bar_code` | Barcode rendered on labels or provided to scanners. |
| `openid` | Tenant scope. |

Additional scanner models:

- `BarcodeAlias`: alternate scan codes for goods and locations.
- `GoodsScanRule`: per-SKU requirements for lot and serial capture plus regex validation.
- `LicensePlate`: pallet/carton/LPN tracking for scan-first receive, putaway, pick, and ship flows.
- `HandheldDeviceSession`: authenticated handheld login/session state, heartbeat, sync time, telemetry rollups, and device metadata.
- `OfflineReplayBatch` / `OfflineReplayEvent`: persisted offline scan uploads, conflict classification, and per-event replay results for receive, putaway, pick, and ship scans.
- `HandheldTelemetrySample`: session-scoped device telemetry snapshots for battery, queue depth, latency, and scan volume.

## Current Role In The Stack

- Catalog uploads can still seed legacy barcode rows through `scanner.ListModel`.
- `backend/utils/scanning.py` resolves direct codes plus `BarcodeAlias` rows for goods and locations.
- Inbound receipt scans can create or update `LicensePlate` rows on receipt and transition them to `STORED` on putaway.
- Outbound pick and ship scans can transition `LicensePlate` rows to `STAGED` and `LOADED`.
- `GoodsScanRule` is enforced when scan payloads provide lot/serial data or attribute barcode content.
- `/api/scanner/device-sessions/` owns handheld start, heartbeat, and end operations.
- `/api/scanner/telemetry-samples/` stores per-session handheld telemetry and updates session aggregates.
- `/api/scanner/offline-replay-batches/` replays queued handheld events through the same inbound/outbound scan services used by online flows.
- Replay now classifies idempotent duplicates vs stale/state-mismatch conflicts instead of treating every repeat upload as a generic failure.

## Near-Term Direction

- keep `scanner` as the home for barcode registry, aliasing, LPN state, device/session depth, and replay telemetry
- avoid duplicating barcode lookup rules across apps; shared scan-code resolution lives in `backend/utils/scanning.py`
- keep scan execution rules in `operations.inbound` and `operations.outbound`; `scanner` should orchestrate sessions and replay, not fork the business logic
