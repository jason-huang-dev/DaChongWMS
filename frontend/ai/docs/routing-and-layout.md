# Routing and Layout

Consistent navigation is critical for operators jumping across warehouse workflows.

## Router

- Use React Router v6+.
- Define application routes under `src/app/routes.tsx` (or similar) and lazy-load feature bundles when possible.
- Group routes by domain (Inventory, Inbound, Outbound, Admin). Example:

```tsx
const routes = [
  {
    path: "/inventory",
    element: <InventoryLayout />,
    children: [
      { path: "items", element: <InventoryItemsPage /> },
      { path: "cycle-counts", element: <CycleCountsPage /> },
    ],
  },
];
```

## Layout Shell

- Global shell wraps router with providers (ThemeProvider, QueryClientProvider, Snackbar provider, etc.).
- Include a persistent sidebar with feature navigation, top bar for global actions (search, user menu), and a main content area supporting responsive tables.

## Breadcrumbs & Context

- Provide breadcrumbs derived from route metadata to keep operators oriented (warehouse > zone > location, etc.).
- Surface contextual filters (warehouse selector) at the layout level when multiple screens share the same context.

## Responsive Considerations

- Optimize for large desktop resolutions first, but ensure breakpoints support tablets/laptops down to 1280px.
- Hide rarely used actions behind kebab menus at narrow widths, but keep primary actions visible.

## Access Control

- Use route guards/HOCs to restrict sections by role. Guard logic should consult the same permission model exposed by the backend.
- Redirect unauthorized users to a friendly “Not Authorized” screen that links to docs or support.
