## Domain-Specific

### API Client & State
- http.ts: TOKEN/OPERATOR headers, VITE_API_BASE_URL proxy.
- TanStack Query: usePaginatedResource, useReferenceOptions (debounced infinite).
- Auth flow: login → MFA verify → localStorage session → staff profile fetch.
- Invalidations: controller-local via query-invalidation.ts groups (['inbound'], ['finance']).
- Workspace: scope-context.tsx (company/warehouse); workspace-preferences.ts (tabs).

### Feature Architecture
- features/<domain>/model/api.ts (endpoints), validators.ts (Zod).
- controller/use*Controller.ts: orchestration; actions.ts: mutations.
- view/*Page.tsx, *Table.tsx, *Form.tsx: MUI composition.
- Dependency rule: no model→controller/view; controllers→model/shared only.

### Forms & Validation
- RHF+Controller+Zod; model/validators.ts schemas.
- Shared: form-text-field.tsx, reference-autocomplete-field.tsx.
- Queue filters: DataViewToolbar with mixed types (date, range, enum).
- Scan-first: autofocus, hotkeys; detail patches via backend-safe fields.

### Frontend Architecture
- Vite+React+TS+MUI7; lazy routes; TanStack Query; RHF+Zod.
- app/: theme.ts, brand.ts, scope-context.tsx, layout/app-shell.tsx.
- shared/: hooks (dataView, bulkSelection), components (toolbar, table).
- JF alignment: workbenches, status buckets, advanced filters, bulk actions.

### JF WMS Reference
- Emulate: horizontal nav, tabbed workspaces, queue workbenches, filter-first queues, status nav, batch/export.
- Modules: homepage, client/product, inbound/outbound, returns, finance, reporting.
- Rules: reuse primitives; multi-tenant/warehouse; dense enterprise density.

### MUI Patterns
- Theme: app/theme.ts with brand tokens (gold/copper/charcoal).
- Layout: Stack/Grid/Box; 24px+ gutters; responsive drawers.
- Tables: ResourceTable with toolbar slot, virtualization.
- Density variant for queues; sx minimal, prefer wrappers.

### Routing & Layout
- app/routes.tsx: lazy feature views; RequireAuth/RequireRoles guards.
- Shell: horizontal nav, workspace tabs (persisted), breadcrumbs, context switcher.
- Detail routes: /inbound/purchase-orders/:id; bulk/queues: /outbound, /finance.

### WMS Product Audit
- Screens: auth/MFA/security, dashboard/inventory, inbound/outbound/transfers/returns/counting/automation/integrations/finance.

\`\`\`typescript
const [count, setCount] = useState<number>(0);

const increment = useCallback(() => {
  setCount(prev => prev + 1);
}, []);
\`\`\`

## Best Practices

- Always define prop interfaces
- Use meaningful component and prop names
- Keep components small and focused (< 200 lines)
- Implement proper TypeScript typing
- Use CSS modules for component-specific styles
- Write unit tests for all components
- Use React.memo for expensive components