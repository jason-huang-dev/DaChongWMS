# MUI Patterns

MUI provides the base component set for the app. Adhering to shared patterns keeps the UI consistent and maintainable.

## Theming

- Define a custom theme under `src/app/theme.ts` with brand colors, typography, and spacing tuned for dense enterprise UIs.
- Build the theme from app-level UI preferences rather than a single static export; `light` and `dark` modes should both be first-class and should reuse the same brand tokens.
- Keep the DaChong gold/copper/charcoal palette in `src/app/brand.ts`, then feed those tokens into `src/app/theme.ts` instead of hard-coding ad-hoc values.
- Store raw logo assets under `src/assets/logo/` and consume them through reusable wrappers like `BrandLogo` instead of importing individual files all over the app.

## Components

- Prefer composition: wrap MUI primitives in domain components (e.g., `<StatusChip status="allocated" />`).
- Tables: use `DataGrid` or custom `Table` with sticky headers, row highlighting, and keyboard navigation.
- Queue tables should expose shared controls through reusable wrappers like `DataViewToolbar` and `ResourceTable` instead of embedding ad-hoc filter rows into each screen.
- Forms: use `TextField`, `Select`, `Autocomplete`, but wrap them with custom components that integrate validation + helper text consistently.
- Shared field wrappers should also be the first place locale-aware label/help-text translation is applied so forms do not each invent their own i18n behavior.

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
- Global shell controls such as locale switching and theme mode toggles should live in shared controls like `UiPreferencesControls`, not be reimplemented per route.
- Tenant/workspace and warehouse switching should go through a shared control such as `WorkspaceContextSwitcher`, not page-specific selects in each route.

## JF-Inspired Enterprise Density Patterns

The reference target is a dense operator console. To match that style without losing maintainability:

- support a compact theme variant for queue pages and workbenches
- prefer shared toolbar, filter-row, secondary-nav, and workbench-card wrappers over large `sx` blocks in route files
- queue pages may use multi-row filter bands above the table when the domain genuinely needs them
- left secondary navigation for status buckets should be a shared pattern, not custom markup per module
- table actions such as refresh, export, customize columns, and help should be placed consistently in the same region of the shell
- homepage/workbench pages should support a center analytical area plus a right utility rail for notices, help, or downloads

The goal is a high-information-density layout that still feels deliberate and consistent.
