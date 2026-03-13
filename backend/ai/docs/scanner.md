# Scanner Module

`scanner.ListModel` mirrors the GreaterWMS barcode registry and backs handheld scans.

## Model Overview

| Field | Purpose |
| --- | --- |
| `mode` | Logical workflow (e.g., `GOODS`, `ASN`, `DN`). |
| `code` | Human-readable identifier (SKU, ASN number, etc.). |
| `bar_code` | Encrypted/hashed barcode rendered on labels. |
| `openid`/`create_time` | Tenant scoping and audit fields. |

## Workflows

- Bulk inserts occur when goods are uploaded; each SKU spawns a scanner row with the hashed barcode computed from the goods code.
- Future workflows (receiving, picking) should append additional scanner rows for documents (ASN, DN, wave) so handheld devices can resolve barcodes without hitting complex joins.

## API & Validation

- Expose read-only endpoints for handheld devices with filters on `mode` and `code`.
- When generating barcodes, prefer deterministic hashes (see `utils.md5.Md5`) to keep physical labels stable across reprints.
- Enforce `request.auth.openid` on every query to avoid cross-tenant leakage of barcode data.
