import { Box, Stack } from "@mui/material";
import { Outlet } from "react-router-dom";

import { inventoryWorkspaceItems } from "@/features/inventory/view/inventory-navigation";
import { PageHeader } from "@/shared/components/page-header";
import { WorkspaceIconNav } from "@/shared/components/workspace-icon-nav";

export function InventoryWorkspaceLayout() {
  return (
    <Stack spacing={3}>
      <PageHeader
        description="Focused inventory workspace with dedicated pages for balances, aging review, manual adjustments, and transfer planning."
        title="Inventory operations"
      />
      <Box
        sx={{
          alignItems: "start",
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "1fr", md: "auto minmax(0, 1fr)" },
        }}
      >
        <WorkspaceIconNav ariaLabel="Inventory workspace pages" items={inventoryWorkspaceItems} />
        <Outlet />
      </Box>
    </Stack>
  );
}
