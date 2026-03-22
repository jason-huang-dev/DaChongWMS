import { Button } from "@mui/material";

import type { ProductMarkRecord } from "@/features/products/model/types";
import { ResourceTable } from "@/shared/components/resource-table";

interface ProductMarkTableProps {
  productMarks: ProductMarkRecord[];
  isLoading: boolean;
  error?: string | null;
  onEdit: (mark: ProductMarkRecord) => void;
}

export function ProductMarkTable({
  productMarks,
  isLoading,
  error,
  onEdit,
}: ProductMarkTableProps) {
  return (
    <ResourceTable
      columns={[
        { header: "Type", key: "type", render: (row) => row.mark_type },
        { header: "Value", key: "value", render: (row) => row.value },
        { header: "Notes", key: "notes", render: (row) => row.notes || "--" },
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
      rows={productMarks}
      subtitle="Handling and compliance marks applied to this product."
      title="Product marks"
    />
  );
}
