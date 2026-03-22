import { Button } from "@mui/material";

import type { DistributionProductRecord } from "@/features/products/model/types";
import { ResourceTable } from "@/shared/components/resource-table";

interface DistributionProductTableProps {
  distributionProducts: DistributionProductRecord[];
  isLoading: boolean;
  error?: string | null;
  onEdit: (distributionProduct: DistributionProductRecord) => void;
}

export function DistributionProductTable({
  distributionProducts,
  isLoading,
  error,
  onEdit,
}: DistributionProductTableProps) {
  return (
    <ResourceTable
      columns={[
        {
          header: "Client",
          key: "client",
          render: (row) => `${row.customer_account_name} (${row.customer_account_code})`,
        },
        { header: "Distribution SKU", key: "externalSku", render: (row) => row.external_sku },
        { header: "Distribution name", key: "externalName", render: (row) => row.external_name || "--" },
        { header: "Channel", key: "channel", render: (row) => row.channel_name || "--" },
        { header: "Dropship", key: "dropship", render: (row) => (row.allow_dropshipping_orders ? "Enabled" : "Disabled") },
        { header: "Inbound", key: "inbound", render: (row) => (row.allow_inbound_goods ? "Enabled" : "Disabled") },
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
      rows={distributionProducts}
      subtitle="Client-specific distribution listings and intake rights."
      title="Distribution products"
    />
  );
}
