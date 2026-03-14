# Scanner Module

`scanner` now owns the barcode registry plus the Y2 scan primitives used by inbound and outbound workflows.

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

## Current Role In The Stack

- Catalog uploads can still seed legacy barcode rows through `scanner.ListModel`.
- `backend/utils/scanning.py` resolves direct codes plus `BarcodeAlias` rows for goods and locations.
- Inbound receipt scans can create or update `LicensePlate` rows on receipt and transition them to `STORED` on putaway.
- Outbound pick and ship scans can transition `LicensePlate` rows to `STAGED` and `LOADED`.
- `GoodsScanRule` is enforced when scan payloads provide lot/serial data or attribute barcode content.

## Near-Term Direction

- keep `scanner` as the home for barcode registry, aliasing, LPN state, and future device/session depth
- avoid duplicating barcode lookup rules across apps; shared scan-code resolution lives in `backend/utils/scanning.py`
- dedicated scanner APIs are still intentionally thin; current handheld flows are exposed through inbound/outbound operational endpoints
