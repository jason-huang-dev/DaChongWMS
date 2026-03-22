import { Button } from "@mui/material";

import type { ProductPackagingRecord } from "@/features/products/model/types";
import { ResourceTable } from "@/shared/components/resource-table";

function formatDimensions(record: ProductPackagingRecord) {
  return `${record.length_cm} x ${record.width_cm} x ${record.height_cm}`;
}

interface ProductPackagingTableProps {
  packagingOptions: ProductPackagingRecord[];
  isLoading: boolean;
  error?: string | null;
  onEdit: (packaging: ProductPackagingRecord) => void;
}

export function ProductPackagingTable({
  packagingOptions,
  isLoading,
  error,
  onEdit,
}: ProductPackagingTableProps) {
  return (
    <ResourceTable
      columns={[
        { header: "Package code", key: "packageCode", render: (row) => row.package_code },
        { header: "Type", key: "type", render: (row) => row.package_type },
        { header: "Units", key: "units", render: (row) => String(row.units_per_package) },
        { header: "Dimensions (cm)", key: "dimensions", render: (row) => formatDimensions(row) },
        { header: "Weight (kg)", key: "weight", render: (row) => row.weight_kg },
        { header: "Default", key: "default", render: (row) => (row.is_default ? "Yes" : "No") },
        { header: "Status", key: "status", render: (row) => (row.is_active ? "Active" : "Inactive") },
        {
          header: "Action",
          key: "action",
          render: (row) => (
            <Button onClick={() => onEdit(row)} size="small" variant="outlined">
              Edit
            </Button>
          ),
        },
      ]}
      error={error}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      rows={packagingOptions}
      subtitle="Storage and shipping pack structures for this product."
      title="Packaging"
    />
  );
}
