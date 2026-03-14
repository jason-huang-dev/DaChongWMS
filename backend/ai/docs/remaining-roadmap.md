# Remaining Roadmap

Core master data, topology, inventory, operational flows, integration control, reporting/billing, DB-backed background workers, worker monitoring, and the current Y2 scan-first inbound/outbound slice are now in place. The remaining work is depth, hardening, and scale.

## Still To Build

### Platform Hardening

- horizontal scale-out from the DB-backed worker to a broker-backed worker model if throughput demands it
- integration credential management, secret rotation, and webhook signature hardening
- audit/event streaming for sensitive operational and commercial actions

### ERP and Carrier Depth

- ERP field-mapping templates, transformation rules, and replay tooling
- carrier rate shopping, manifest closeout, pickup scheduling, and multi-parcel cartonization
- EDI and ASN message orchestration for higher-volume customers
- integration-specific quarantine queues and richer manual replay tooling

### Billing and Finance Depth

- settlement exports beyond CSV, remittance integration, and payment-status ingestion
- dispute management, credit-note workflows, and finance-facing adjustments
- contract models for more complex pricing dimensions such as pallet/day, carton, weight, and service-level tiers

### Warehouse Execution Depth

- wave planning, batch picking, cartonization, and dock-door load sequencing
- slotting optimization, labor planning, and task interleaving
- QA workflows for damage inspection, recall quarantine, and compliance holds
- yard, trailer, and appointment scheduling where dock orchestration matters

## Y2 Shipping Model Capabilities

The Y2 stream has started, but only with the first scan-first receive and ship slice.

### Built So Far

- scan receive using purchase-order number or ASN number, location barcode, SKU barcode, optional LPN, and lot/serial attribute parsing
- scan putaway completion using task number plus source/destination/SKU scans and optional LPN validation
- scan pick completion using task number plus source/destination/SKU scans and optional LPN validation
- scan ship using sales-order number, shipment number, staging barcode, optional dock/LPN scans, and lot/serial attribute parsing
- barcode alias resolution for goods and locations
- dock-load verification records tied to scan-first shipping

### Still Needed For Y2 Receiving and Scanning

- blind receiving mode for unknown loads, followed by reconciliation to purchase orders or returns
- pallet, carton, case, and item hierarchy capture beyond a single tracked LPN using SSCC/LPN-style identifiers
- enforced lot, serial, expiry, GS1, UDI, or barcode parsing rules per SKU or owner
- over, short, damaged, and substitution exception capture during scan receive
- photo or evidence attachment for inbound discrepancies and damage claims
- cross-dock and transfer receive scans that skip long-term storage when the workflow requires it

### Still Needed For Handheld and Scanner Depth

- device sessions, offline queueing, replay, and conflict handling
- barcode alias tables for supplier, customer, and internal product identifiers beyond current goods/location coverage
- product-level scan validation rules such as quantity-per-scan and serial uniqueness
- scanner telemetry, productivity metrics, and exception analytics

### Still Needed For Shipping Control Tower Depth

- cartonization and label reprint controls tied to shipment execution
- shipment manifest scan closeout and carrier handover confirmation
- customer-facing event feeds for receive, scan, pick, pack, and ship milestones

## Recommendation

The next practical steps are:

1. add handheld/device session depth and offline replay on top of the current Y2 scan flow
2. extend finance to remittance, dispute, and multi-dimension rating workflows
3. decide on broker-backed execution based on the new automation heartbeat/alert metrics
