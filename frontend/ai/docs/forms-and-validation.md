# Forms and Validation

Warehouse workflows rely on accurate data entry; form UX must be predictable and forgiving.

## Form Library

- Use React Hook Form for performant, flexible form state.
- Provide custom input wrappers (`RHFTextField`, `RHFSelect`) that connect MUI components to RHF controllers.

## Validation Strategy

- Prefer Zod or Yup schemas for declarative validation. Keep schemas near form definitions but export them for reuse in API typings.
- Mirror backend validation rules to minimize round-trips. When backend constraints are complex, surface summarized rules in helper text.

## UX Guidelines

- Group related fields (e.g., item details, location info) with visual dividers.
- Surface inline errors beneath inputs; include action-oriented copy (“Quantity must be greater than zero”).
- Provide keyboard-friendly navigation for high-volume data entry (tab order, enter-to-submit, scanner shortcuts).

## Submission Flow

- Disable submit buttons while mutations are in flight; show progress indicators on long operations.
- On success, toast and reset/redirect depending on workflow (e.g., remain on page for repetitive receiving tasks).
- On failure, log structured error data and map backend field errors onto the relevant inputs.

## Testing

- Write component tests for critical forms to ensure validation + submission flows do not regress.
- Cover edge cases like blank scans, duplicate SKUs, and concurrency conflicts by mocking backend responses.
