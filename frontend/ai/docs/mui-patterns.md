# MUI Patterns

MUI provides the base component set for the app. Adhering to shared patterns keeps the UI consistent and maintainable.

## Theming

- Define a custom theme under `src/app/theme.ts` with brand colors, typography, and spacing tuned for dense enterprise UIs.
- Keep the DaChong gold/copper/charcoal palette in `src/app/brand.ts`, then feed those tokens into `src/app/theme.ts` instead of hard-coding ad-hoc values.
- Store raw logo assets under `src/assets/logo/` and consume them through reusable wrappers like `BrandLogo` instead of importing individual files all over the app.

## Components

- Prefer composition: wrap MUI primitives in domain components (e.g., `<StatusChip status="allocated" />`).
- Tables: use `DataGrid` or custom `Table` with sticky headers, row highlighting, and keyboard navigation.
- Forms: use `TextField`, `Select`, `Autocomplete`, but wrap them with custom components that integrate validation + helper text consistently.

## Layout

- Use `Stack`, `Grid`, and `Box` for spacing; rely on theme spacing scale (multiples of 4).
- Keep page gutters at 24px+, with responsive adjustments for small screens.

## Accessibility

- Ensure `aria` labels on icon buttons, menus, and dialogs.
- Provide focus styles that meet contrast guidelines.
- Use `VisuallyHidden` text for barcode scanner shortcuts or status icons.

## Performance

- Memoize heavy components (tables, charts) and enable virtualization when rendering long lists.
- Tree-shake icons by importing from `@mui/icons-material/<Icon>` individually.

## Customization

- Centralize overrides in the theme rather than scattered `sx` props. If a pattern repeats more than twice, wrap it in a shared component.
- Auth-specific full-screen layouts should use a shared wrapper like `AuthShell` so branding, spacing, and responsive behavior stay consistent across login, signup, and MFA challenge screens.
