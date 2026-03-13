# Catalog Data Models

The catalog domain captures every SKU and the metadata required to validate inbound uploads. The apps now live under the `backend/catalog/` package and are implemented via the following Django apps:

| App | Model | Purpose |
| --- | --- | --- |
| `goods` | `ListModel` | Authoritative record for each SKU, including physical dimensions, cost/price, and owning tenant (`openid`). |
| `goodsunit` | `ListModel` | Master data for stocking/ordering units of measure. |
| `goodsclass` | `ListModel` | Logical classifications (commodity groups). |
| `goodsbrand` | `ListModel` | Brand registry tied to the tenant. |
| `goodscolor`/`goodsshape`/`goodsspecs`/`goodsorigin` | `ListModel` variants | Attribute vocabularies for color/shape/specification/origin fields referenced by goods rows. |

## Business Rules

- All catalog tables scope records by `openid` for multi-tenant isolation. Upload endpoints enforce this via request auth.
- `goods.ListModel.goods_code` is unique and acts as the SKU identifier referenced by inventory, ASN, and DN flows.
- Attribute tables (`goodsunit`, etc.) are de-duplicated; uploads either create missing rows or reuse existing ones, ensuring referential consistency without foreign-key constraints.
- Soft deletes (`is_delete`) preserve history. API layers should filter `is_delete=False`.

## API & Workflows

- Bulk creation happens through `uploadfile.views.GoodlistfileViewSet` and `GoodlistfileAddViewSet`, which normalize spreadsheet headers (see `uploadfile` docs) and fan out into the tables above.
- Future CRUD endpoints should use DRF viewsets with tenant- scoped querysets, pagination, and ordering on `create_time`/`update_time`.
- Any API that mutates goods MUST recompute barcode hashes (`utils.md5.Md5`) to keep scanner data consistent.

## Validation & Edge Cases

- `goods_unit`, `goods_class`, etc. default to safe placeholder strings to avoid null text when upstream spreadsheets omit values.
- Dimensions default to zero but should be validated for non-negative ranges before enabling advanced storage algorithms.
- `goods.goods_code` uniqueness is enforced at the model/database level; uploads catch duplicates and return a descriptive failure.

## Security & Auditability

- Treat catalog changes as sensitive: incorrect dimensions or supplier data can break downstream picking and freight rating.
- Log user/`staff_name` for every upload (handled in uploadfile views) and persist `creator` for audit trails.
- Deny cross-tenant reads/writes by always filtering on `request.auth.openid`.
