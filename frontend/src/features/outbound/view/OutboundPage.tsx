import Grid from "@mui/material/Grid";
import { Stack } from "@mui/material";

import { useOutboundController } from "@/features/outbound/controller/useOutboundController";
import { CreateShipmentPanel } from "@/features/outbound/view/components/CreateShipmentPanel";
import { ScanPickPanel } from "@/features/outbound/view/components/ScanPickPanel";
import { ScanShipPanel } from "@/features/outbound/view/components/ScanShipPanel";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function OutboundPage() {
  const {
    createShipmentMutation,
    pickTasksQuery,
    salesOrdersQuery,
    shipmentErrorMessage,
    shipmentSuccessMessage,
    shipmentsQuery,
  } = useOutboundController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="View allocation, pick, and shipment activity for outbound execution, including scan-first handheld actions."
        title="Outbound operations"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 4 }}>
          <CreateShipmentPanel
            errorMessage={shipmentErrorMessage}
            isPending={createShipmentMutation.isPending}
            onSubmit={(values) => createShipmentMutation.mutateAsync(values)}
            successMessage={shipmentSuccessMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ScanPickPanel />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ScanShipPanel />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ResourceTable
            columns={[
              { header: "Order", key: "order", render: (row) => <RecordLink to={`/outbound/sales-orders/${row.id}`}>{row.order_number}</RecordLink> },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
              { header: "Customer", key: "customer", render: (row) => row.customer_name },
              { header: "Ship date", key: "shipDate", render: (row) => formatDateTime(row.requested_ship_date) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={salesOrdersQuery.error ? parseApiError(salesOrdersQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={salesOrdersQuery.isLoading}
            rows={salesOrdersQuery.data?.results ?? []}
            subtitle="Outbound demand waiting to be picked or shipped"
            title="Sales orders"
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Task", key: "task", render: (row) => row.task_number },
              { header: "Order", key: "order", render: (row) => row.order_number },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "From", key: "from", render: (row) => row.from_location_code },
              { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.quantity) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={pickTasksQuery.error ? parseApiError(pickTasksQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={pickTasksQuery.isLoading}
            rows={pickTasksQuery.data?.results ?? []}
            subtitle="Current pick execution queue"
            title="Pick tasks"
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Shipment", key: "shipment", render: (row) => row.shipment_number },
              { header: "Order", key: "order", render: (row) => row.order_number },
              { header: "Stage", key: "stage", render: (row) => row.staging_location_code },
              { header: "Shipped by", key: "by", render: (row) => row.shipped_by || "--" },
              { header: "Shipped at", key: "at", render: (row) => formatDateTime(row.shipped_at) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={shipmentsQuery.error ? parseApiError(shipmentsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={shipmentsQuery.isLoading}
            rows={shipmentsQuery.data?.results ?? []}
            subtitle="Outbound shipment confirmations"
            title="Shipments"
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
