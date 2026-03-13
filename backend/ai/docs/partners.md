# Partner & Financial Master Data

The partner domain covers suppliers, customers, and transportation partners. Django apps:

- `supplier.ListModel` – onboarding data for vendors delivering inbound goods.
- `customer.ListModel` – ship-to parties for outbound orders.
- `payment.TransportationFeeListModel` – matrix of carrier rates used to price shipments.
- `capital.ListModel` – tenant-level capital pools for prepaid services or internal accounting.

## Business Rules

- Each record is linked to an `openid` tenant and includes a `creator`. Upload flows (supplier/customer/capital/freight endpoints) must set both fields from the authenticated staff user.
- Supplier/customer levels default to `0` and may be used later for SLA logic (expedite vs. normal).
- Transportation fee rows are unique per `(send_city, receiver_city, transportation_supplier)` tuple; uploads de-dupe by clearing tenant data before reimporting a canonical matrix.
- Capital balances store both quantity and cost, enabling lightweight valuation without a formal ledger.

## API Expectations

- Initial CRUD exposure is via the upload endpoints: `SupplierfileViewSet`, `CustomerfileViewSet`, `CapitalfileViewSet`, and `FreightfileViewSet` (plus the `*_add` incremental variants).
- Future DRF viewsets should support filtering by city, manager, or supplier level, and must enforce `openid` scoping.
- When integrating with ASN/DN modules, foreign keys can be added referencing these tables; until then, `goods` rows store textual supplier/customer references.

## Validation & Security

- Phone numbers (`supplier_contact`, `customer_contact`) are stored as strings to accommodate extensions; upstream uploads should sanitize obvious injection attempts via `utils.datasolve.data_validate`.
- Freight rows accept zeros, but downstream pricing logic should warn operators if both `weight_fee` and `volume_fee` are zero to avoid free shipments.
- Capital adjustments should be wrapped in transactions once financial workflows are added to prevent race conditions.
