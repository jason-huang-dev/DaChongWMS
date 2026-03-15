import { Stack } from "@mui/material";

import { useInventoryController } from "@/features/inventory/controller/useInventoryController";
import { InventoryTable } from "@/features/inventory/view/InventoryTable";
import { PageHeader } from "@/shared/components/page-header";

export function InventoryBalancesPage() {
  const { page, pageSize, setPage, balancesQuery } = useInventoryController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Tenant-scoped inventory positions. This is the current on-hand, allocated, and held stock state by location and SKU."
        title="Inventory balances"
      />
      <InventoryTable balancesQuery={balancesQuery} page={page} pageSize={pageSize} setPage={setPage} />
    </Stack>
  );
}
