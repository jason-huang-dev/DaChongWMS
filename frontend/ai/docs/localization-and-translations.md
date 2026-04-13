# Localization and Translations

The frontend now treats localization as a strict application contract, not a best-effort enhancement.

## Core Principle

**Localize the application, not the data.**

This means:

- application-owned UI text must be translated through the catalog
- system-defined codes and workflow labels may map to translated labels
- business data, imported data, and user-generated content must remain exactly as stored or received

If a value is already in another language, it should stay in that original language.

## Problem We Are Fixing

The old translation path mixed two different models:

- typed message keys for a small subset of reusable UI copy
- raw English string lookup for legacy screens and shared components

That approach made incremental retrofits easy, but it created several long-term problems:

- untranslated UI could slip in silently because any plain English string might still render
- dynamic labels such as workspace or warehouse chips relied on hidden fallback logic
- engineers had no single rule for how new copy should be authored
- raw backend values and UI copy were too easy to confuse

The result was predictable: the codebase accumulated a large amount of UI text that looked partially localized instead of consistently translated.

## New Translation Contract

The application now uses one catalog-driven translation system in `frontend/src/app/i18n.ts`.

Rules:

- every translatable application UI string must exist in the catalog
- no runtime auto-translation from arbitrary English text is allowed
- locale catalogs must have the same key set
- dynamic application UI copy must use parameterized messages, not template-string concatenation
- raw data values must never be auto-translated at runtime
- only explicit system-owned enums, codes, and application labels may map to translated strings

Runtime behavior:

- missing keys must be treated as defects and logged immediately
- the live UI should render a visible fallback instead of crashing the route
- tests and CI should still fail hard on missing keys

## What Gets Translated

The catalog is for application-owned copy such as:

- navigation labels
- buttons
- dialogs
- helper text
- form labels
- column headers
- filter labels
- empty states
- toolbars
- workflow instructions
- system-defined status labels
- other shared application chrome

## What Stays As-Is

The following must be rendered exactly as stored or received unless the product explicitly models them as multilingual fields:

- warehouse names
- customer names
- supplier names
- product names
- SKU values
- lot numbers
- addresses
- notes and comments
- uploaded document titles
- imported ERP, WMS, or partner-system text
- user-entered descriptions
- audit payload details

Examples:

- If a warehouse name is `东莞一号仓`, it stays `东莞一号仓`.
- If a customer note is `Urgente, enviar hoy`, it stays `Urgente, enviar hoy`.

## Supported Authoring Patterns

The two supported authoring patterns are:

### 1. Direct key lookup for normal application UI copy

```tsx
const { t } = useI18n();

<Button>{t("auth.signIn")}</Button>
```

### 2. Message descriptors for dynamic application text passed through shared components

```tsx
const { msg } = useI18n();

<DataViewToolbar contextLabel={msg("shell.warehouseChip", { label: warehouseName })} />
```

In this example, the surrounding application copy is translated, but `warehouseName` remains in its original stored language.

## API Surface

`useI18n()` is the only frontend runtime entry point for translated application copy.

- `t(key, params?)`
  - translates a catalog key immediately
- `translate(message)`
  - resolves either a plain catalog key or a message descriptor
- `msg(key, params?)`
  - creates a message descriptor for deferred translation in shared components

## Shared Component Rules

Shared components that render application-owned labels, titles, helper text, subtitles, chip labels, or table filter copy should accept translatable values and resolve them internally.

Examples:

- `PageHeader`
- `MetricCard`
- `MutationCard`
- `DetailCard`
- `DataViewToolbar`

This keeps feature code compact while preserving a single translation mechanism.

Shared components must also clearly distinguish between:

- application copy, which is translatable
- data values, which are rendered as-is

For example, a shared card should translate its `label` but render its `value` unchanged.

## Feature Rules

Feature code must follow these rules:

- use `t(...)` for application copy rendered directly inside the feature
- use `msg(...)` when passing parameterized application copy into shared components
- do not concatenate translated labels with runtime values using raw template strings
- do not add new `translateText(...)` style helpers or raw-string lookup layers
- do not pass raw backend text through the translation catalog unless that field is an explicit system code or enum

Correct:

```tsx
<Typography>{t("auth.backToLogin")}</Typography>
<MetricCard helper={msg("shell.warehouseChip", { label: warehouseName })} label={msg("context.warehouse") } value={warehouseName} />
```

Also correct:

```tsx
<Typography>{t("inventory.showingResultsForWarehouse", { warehouse: warehouseName })}</Typography>
```

Incorrect:

```tsx
<Typography>{`Warehouse: ${warehouseName}`}</Typography>
<Typography>{someEnglishLiteralFromBackend}</Typography>
<Typography>{t(customerNote)}</Typography>
```

## Persistence Rules

Persist canonical translation keys or message metadata, not already-localized output.

Examples:

- route tabs should store a stable catalog key such as `Inventory`
- saved view metadata may store a message descriptor key plus params
- locale-specific rendered strings should only be produced at render time

This prevents saved UI state from becoming stale, mixed-language, or impossible to re-render correctly after a locale switch or catalog update.

## System Codes Versus Raw Data

A hard boundary must exist between system-defined values and raw data.

### System codes

These are controlled application values and may be translated.

Example:

```json
{
  "status_code": "pending_putaway"
}
```

The frontend may map this code to:

- English: `Pending putaway`
- Chinese: `待上架`
- Spanish: `Pendiente de ubicación`

### Raw data

These must remain unchanged.

Example:

```json
{
  "warehouse_name": "东莞一号仓",
  "customer_note": "急件，今天必须出库"
}
```

The frontend must render those values exactly as received.

## Catalog Structure

The catalog currently supports both:

- semantic keys for parameterized and shared UI, such as `shell.warehouseChip`
- source-text keys for existing static UI, such as `Sign in`

This is intentional during migration. The important rule is that all application copy must be explicitly present in the catalog. The runtime no longer treats an arbitrary string as translatable just because it happens to be English.

Long term, prefer semantic, feature-scoped keys for stable product copy.

## Backend Contract

The backend should follow the same boundary.

Translate:

- validation errors
- permission errors
- admin labels
- server-generated emails
- other system-owned backend strings

Do not translate:

- stored business data
- imported external data
- user-generated free text

Prefer returning canonical codes for enums and workflow states rather than translated display labels.

Recommended API shape:

```json
{
  "id": 123,
  "warehouse_name": "东莞一号仓",
  "customer_name": "Acme Imports LLC",
  "status_code": "pending_putaway",
  "note": "优先处理"
}
```

Frontend behavior:

- `warehouse_name` -> render as-is
- `customer_name` -> render as-is
- `note` -> render as-is
- `status_code` -> map to translated application label

## Migration Guidance

When touching a feature:

1. Replace direct `translateText(...)` usage with `t(...)` or `translate(...)`.
2. Replace dynamic template strings with `msg(...)` plus a parameterized catalog entry.
3. Add missing catalog keys before rendering the new UI.
4. Prefer semantic, feature-scoped keys for newly added dynamic or business-relevant application copy.
5. Do not move raw backend data into the catalog.
6. Move backend-derived enums and status codes onto explicit frontend translation maps.

## Validation And CI Expectations

The follow-up validation work should enforce the contract by failing CI when:

- untranslated JSX application text is introduced
- catalog keys are missing in any supported locale
- shared components receive raw translation fallbacks
- application code attempts to translate raw backend data directly

## Summary Rule

Use the catalog for application-owned language.

Keep business data exactly as-is.

Translate system codes intentionally.

Do not translate raw values just because they happen to be strings.
