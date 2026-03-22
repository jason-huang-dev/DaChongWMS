# Logistics

`apps.logistics` is the modular backend domain for carrier configuration, routing rules, and logistics finance.

## Scope

- logistics providers
- provider channels for `ONLINE` and `OFFLINE` execution
- customer logistics channel mappings
- logistics groups
- logistics rules
- partition rules
- remote-area rules
- fuel rules
- waybill watermarks
- logistics charging strategies
- special customer logistics charging overrides
- logistics charges
- logistics costs

## Design intent

- Treat online and offline logistics as channel modes, not separate provider models.
- Keep logistics provider and channel setup organization-scoped.
- Keep customer-specific routing and pricing separate from the customer-account master data in `apps.partners`.
- Keep operational charge capture separate from carrier-side cost capture so margin review and reconciliation stay explicit.

## Permission model

- `logistics.view_logistics`
- `logistics.manage_logistics_providers`
- `logistics.manage_logistics_rules`
- `logistics.manage_logistics_charging`
- `logistics.manage_logistics_costs`

These permissions are resolved through `apps.iam` like the rest of the modular backend.

## API shape

All endpoints are organization-scoped under:

`/api/v1/organizations/<organization_id>/logistics/...`

Key collections:

- `providers/`
- `groups/`
- `provider-channels/`
- `customer-channels/`
- `rules/`
- `partition-rules/`
- `remote-area-rules/`
- `fuel-rules/`
- `waybill-watermarks/`
- `charging-strategies/`
- `special-customer-charging/`
- `charges/`
- `costs/`

## Modeling notes

- `LogisticsProviderChannel.channel_mode` partitions online and offline execution.
- `LogisticsRule.rule_scope` allows broad or mode-specific routing.
- `LogisticsCharge.total_amount` and `LogisticsCost.total_amount` are derived from their component monetary fields.
- Cross-organization foreign-key validation is enforced in model `clean()` methods.
