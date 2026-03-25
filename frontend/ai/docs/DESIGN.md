# Dachong WMS Design System
## Theme Strategy: Industrial Kinetic with User-Controlled Light/Dark Modes

## 1. Overview & Creative North Star
**Creative North Star: The Precision Architect**

This design system is built to transform complex warehouse and ERP workflows into a refined, high-clarity interface. We are intentionally avoiding the cluttered, generic look common in enterprise software. Instead, Dachong WMS should feel structured, operational, and premium—like a system designed with the precision of a blueprint.

The interface should support **both dark mode and light mode** with a user-facing theme toggle. The visual language, spacing, hierarchy, and component behavior must remain consistent across both modes. Theme switching is a product feature, not an afterthought.

### Core Principles
- High information clarity without visual clutter.
- Strong hierarchy through spacing, typography, and surface separation.
- Minimal reliance on borders; prefer tonal contrast and layout structure.
- Industrial character with polished, modern interaction design.
- Theme parity: light mode and dark mode must both feel first-class.

---

## 2. Theme Strategy

### 2.1 Theme Availability
Users must be able to switch between:
- **Light mode**
- **Dark mode**
- Optional future enhancement: **System mode** that follows the device or browser preference.

### 2.2 Theme Switching Rules
- Theme switching should be available from the application UI, ideally in a global header, user menu, or settings area.
- The selected theme should persist across sessions.
- The switch should update the full application consistently, including dashboards, tables, forms, dialogs, navigation, and status surfaces.
- Both themes must use the same design tokens, component structure, spacing scale, and typography system.
- Theme switching must not break contrast, legibility, or status communication.

### 2.3 Design Intent by Theme
- **Dark mode:** Operational, focused, high-contrast, ideal for long warehouse and dashboard sessions.
- **Light mode:** Clean, structured, airy, useful for office workflows, data entry, and reporting.

Dark mode is part of the brand expression, but light mode must be equally polished and fully supported.

---

## 3. Color System
Our palette is rooted in industrial utility and anchored by Dachong’s signature yellow.

### 3.1 Brand Accent
- **Primary:** `#795900`
- **Primary Container / Brand Highlight:** `#F9C344`

Use the yellow family sparingly for:
- Primary actions
- Active states
- Critical highlights
- Selected rows or emphasized operational signals

Do not flood the interface with yellow backgrounds.

### 3.2 Dark Theme Tokens
- `background`: `#1A1C1C`
- `surface`: `#202222`
- `surface-secondary`: `#2D2F2F`
- `surface-variant`: `#44483E`
- `text-primary`: `#E1E2E2`
- `text-secondary`: `#B8BCBC`
- `outline-variant`: `#8C9286`
- `accent`: `#F9C344`
- `accent-strong`: `#795900`

### 3.3 Light Theme Tokens
- `background`: `#F5F5F5`
- `surface`: `#FFFFFF`
- `surface-secondary`: `#ECEDE8`
- `surface-variant`: `#E2E4DE`
- `text-primary`: `#1F2320`
- `text-secondary`: `#4E5550`
- `outline-variant`: `#B5BAAF`
- `accent`: `#F9C344`
- `accent-strong`: `#795900`

### 3.4 Surface Hierarchy Rule
The system should rely on **surface layering** instead of heavy lines.

- In dark mode, a card should sit on a slightly different dark workspace tone.
- In light mode, a white or near-white surface should sit on a soft neutral workspace.
- Use borders only when required for accessibility, dense tables, or input clarity.

### 3.5 The No-Line Rule
Standard sectioning should not depend on constant 1px borders. Prefer:
- Tonal changes
- Spacing
- Background contrast
- Accent states

If a divider is necessary, it should be subtle and token-based.

### 3.6 Semantic Status Color Rules
Operational software must use color with discipline and consistency.

- Success should use a clear green family and appear on completion, confirmation, and healthy system states.
- Info should use a calm blue family for neutral guidance, progress, and secondary operational emphasis.
- Warning should use the yellow family for caution, pending review, and workflow states that require attention but are not failures.
- Error should use a restrained red family for failures, blocked work, and destructive risk.
- Brand yellow is not the only highlight color. It remains the system accent, but semantic states must keep their own hue families.
- Never rely on color alone. Pair status color with iconography, text, or both.
- Status colors must be consistent across cards, tables, chips, metrics, and navigation badges in both themes.
- Status communication should be visible at scanning speed. Use small dots, edge accents, chips, or metric deltas so operators can read queue state without opening a detail view.
- Dense operational screens should prefer one strong status cue per row or card instead of several competing highlight colors.

---

## 4. Typography
We use **Manrope** for its geometric clarity, strong readability, and modern industrial character.

### Type Roles
- **Display Large:** `3.5rem` — reserved for hero metrics and high-level operational summaries.
- **Headline Medium:** `1.75rem` — main section titles.
- **Title Medium:** `1.125rem` — card titles, panel headings, modal titles.
- **Body Medium:** `0.875rem` — primary body and table-adjacent reading content.
- **Label Medium:** `0.75rem` — table headers, field labels, metadata.

### Typography Rules
- Maintain generous line-height for readability in dense operational views.
- Use slightly tighter tracking for larger headings.
- Use uppercase labels sparingly for technical clarity, especially in filters, forms, and data tables.
- Typography hierarchy must remain identical in both themes.
- The application should assume an information-dense baseline. Page titles should cap at roughly `18px`, and the rest of the type scale should stay compact enough for dashboards, workbenches, tables, and forms to coexist without visual crowding.

---

## 5. Elevation & Depth
Depth should communicate structure, not decoration.

### Layering Principle
Treat the UI as stacked working surfaces.
- Main page background
- Workspace section
- Card or panel surface
- Floating overlays like dialogs or dropdowns

### Shadows
- Use soft ambient shadows only for floating elements such as modals, popovers, and menus.
- Avoid heavy shadows on standard cards.
- In light mode, shadows may be slightly more visible than in dark mode, but still restrained.

### Glass & Blur Usage
For floating headers or side panels:
- Use light transparency with blur when appropriate.
- The effect must remain subtle and functional.
- Blur should never reduce legibility.

---

## 6. Components

### 6.1 Buttons
**Primary Button**
- Uses the yellow accent family.
- Clear contrast in both themes.
- May use a subtle gradient only if it remains refined and consistent.

**Secondary / Tertiary Button**
- Minimal visual weight.
- Prefer text emphasis, tonal surfaces, or quiet outlines.

### 6.2 Inputs
- Inputs should sit clearly on their parent surface.
- Avoid heavy boxed styling unless required by density or accessibility.
- Focus states should use the brand accent or a clearly accessible focus ring.
- Light and dark modes must both provide strong distinction between input background, page background, and focus state.

### 6.3 Cards
- Cards should feel like organized operational modules.
- Use spacing, layout, and surface hierarchy instead of divider clutter.
- Card headers may use a subtle tonal band when needed to anchor the section.
- Summary and metric cards should expose state quickly. Use a small semantic indicator, restrained accent treatment, and clear primary value hierarchy before adding more decoration.
- If a metric card is clickable, the interactivity should be visible through a compact hover/focus response and a clear “open” affordance, not a generic button treatment.

### 6.4 Chips and Tags
- Use pills or softly rounded elements to contrast with the structured layout.
- Status chips must preserve meaning in both themes.
- Never rely on color alone; include text labels or icons where appropriate.

### 6.5 Data Grids
Warehouse software depends heavily on tables, so grid usability is critical.

Rules:
- Minimize vertical lines.
- Use zebra striping or tonal row variation where helpful.
- Highlight active or selected rows with a clear left-edge accent or full-row state.
- Maintain strong hover, focus, and selected states in both themes.
- Filters, sorting, and bulk actions should feel integrated rather than visually bolted on.
- Dense tables should support scan speed with consistent header styling, restrained striping, and one dominant row-level state treatment at a time.

### 6.5.1 Workbench Summaries
Operational workbench pages should not begin with only raw tables.

Rules:
- Start major workbench screens with a compact summary band of metric cards or status summaries when the workflow has queue volume, backlog, or exception pressure.
- Summary metrics should deep-link into the most relevant section or filtered list whenever possible.
- Exception lanes should expose both severity and queue size clearly so operators can decide what to clear first.

### 6.6 Navigation & Shell
The application shell is part of the product, not a neutral wrapper.

Rules:
- The global shell must communicate active context through layout, color, and stateful emphasis.
- Primary navigation, workspace tabs, and context controls should use distinct but related interaction treatments.
- Active routes should be visible immediately through accent placement, surface change, and icon/text emphasis.
- Hover and focus states should be discoverable without becoming decorative noise.
- Header controls should feel compact, but never cramped or visually ambiguous.
- Any floating or sticky navigation surface must reserve enough layout space to avoid content clipping.
- Reusable navigation elements should communicate state with more than text weight alone. Prefer a combination of surface shift, edge accent, and a restrained live/status indicator when the workflow benefits from it.

---

## 7. Interaction & UX Rules

### 7.1 Theme Toggle UX
- The user must be able to switch themes without navigating away from their workflow.
- Theme transitions should feel smooth but fast.
- Do not animate large surfaces excessively.
- The toggle control should be intuitive and visible enough to discover.

### 7.2 Feedback States
All interactive states must be defined for both themes:
- Hover
- Focus
- Active
- Disabled
- Selected
- Error
- Warning
- Success

### 7.3 Accessibility
- Maintain accessible contrast in light and dark modes.
- Focus visibility is mandatory.
- Theme switching must not reduce readability in tables, forms, or navigation.
- Semantic colors must remain understandable for users with low vision or color-vision deficiencies.

### 7.4 Microinteraction System
Microinteractions should make the product feel responsive and trustworthy, not playful.

Rules:
- Every important interactive control should have visible hover, focus, pressed, disabled, and selected states.
- Use motion to confirm state change, not to decorate. Prefer subtle elevation, tonal shift, indicator movement, or small translation.
- Typical motion should stay in a short range: roughly `160ms` to `320ms`.
- Use one standard easing curve across the application so the system feels coherent.
- Active navigation states should animate with a restrained indicator transition rather than abrupt jumps.
- Menus, buttons, tabs, and chips may use subtle transform or shadow changes, but never large bounces or attention-seeking animation.
- Loading, refreshing, and “working” states should be visually obvious. Progress, pending review, or online/live states should not be silent.
- Respect reduced-motion preferences. Motion should degrade gracefully instead of being required for comprehension.

### 7.5 Operational Feedback Patterns
Warehouse and ERP interfaces must make system response visible without forcing the user to read every label.

Rules:
- Use semantic color to expose workflow state in queue navigation, status chips, summary cards, and table rows.
- Show “live”, “pending”, “blocked”, and “completed” states through clear visual markers such as dots, left accents, progress lines, badges, or count treatments.
- Important interactions should acknowledge success or selection immediately through a local state change such as indicator movement, a tonal surface shift, or a compact elevation change.
- Avoid decorative animation in operational lists. Fast local feedback is preferred over global page motion.
- Any interaction pattern added for delight must still serve clarity, hierarchy, or status recognition.

---

## 8. Spacing & Layout
The layout should feel intentional and breathable.

### Spacing Intent
- Use generous spacing between major operational modules.
- Maintain tighter but still readable spacing inside dense forms and data tables.
- Avoid cramped rows, especially in warehouse-facing operational screens.

### Layout Character
- Favor asymmetrical editorial layouts where useful.
- Use wider primary work areas and narrower supporting side panels when the workflow benefits from it.
- Preserve consistency so that dashboards, detail pages, and forms still feel related.

---

## 9. Do's and Don'ts

### Do
- Do support both light mode and dark mode as first-class experiences.
- Do keep brand identity consistent across themes.
- Do use surface hierarchy and spacing before adding borders.
- Do design tables, filters, and forms with operational efficiency in mind.
- Do persist the user’s theme choice.
- Do show interactive state changes clearly through subtle motion and semantic color.
- Do keep shell-level navigation states obvious at a glance.

### Don't
- Don’t treat light mode as a fallback or unfinished variant.
- Don’t mix light-theme rules and dark-theme rules without clear token separation.
- Don’t overuse bright yellow as a background fill.
- Don’t rely on color alone to communicate meaning.
- Don’t create separate component behavior by theme; only visuals should change, not usability patterns.
- Don’t animate large surfaces or whole pages when a smaller local motion cue will do.
- Don’t make motion so subtle that state change becomes invisible.

---

## 10. Implementation Guidance
- Implement theme tokens through a centralized design token or theme provider system.
- Components should consume semantic tokens such as `background`, `surface`, `text-primary`, and `accent` rather than hardcoded colors.
- Semantic status tokens and motion tokens should also be centralized rather than duplicated at component level.
- Both themes should be tested on dashboards, tables, forms, dialogs, navigation, and alerts.
- New components must launch with support for both themes by default.
- Reduced-motion behavior should be considered part of component implementation, not an enhancement.
- Shared components such as shell navigation, status bucket navigation, chips, tables, and cards should encode the system’s motion and status language once so feature teams do not reinvent it.
- Shell layout must avoid “magic-number” content offsets where possible. Prefer sticky or naturally flowing header structures that reserve their own space.

---

## 11. Summary
Dachong WMS should feel industrial, modern, and operationally sharp. The system’s visual identity comes from structured spacing, premium typography, restrained accent usage, and a strong surface hierarchy.

Most importantly, the application must support **user-controlled light and dark modes**, with both modes designed intentionally and maintained as part of the core product experience.
