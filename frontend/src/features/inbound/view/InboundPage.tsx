import Grid from "@mui/material/Grid";
import { Stack } from "@mui/material";

import { useInboundController } from "@/features/inbound/controller/useInboundController";
import { CreateReceiptPanel } from "@/features/inbound/view/components/CreateReceiptPanel";
import { ScanPutawayPanel } from "@/features/inbound/view/components/ScanPutawayPanel";
import { ScanReceivePanel } from "@/features/inbound/view/components/ScanReceivePanel";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function InboundPage() {
  const {
    createReceiptMutation,
    purchaseOrdersQuery,
    putawayTasksQuery,
    receiptErrorMessage,
    receiptSuccessMessage,
    receiptsQuery,
  } = useInboundController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="View the current inbound workload across purchasing, receipt posting, putaway completion, and scan-first handheld actions."
        title="Inbound operations"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 4 }}>
          <CreateReceiptPanel
            errorMessage={receiptErrorMessage}
            isPending={createReceiptMutation.isPending}
            onSubmit={(values) => createReceiptMutation.mutateAsync(values)}
            successMessage={receiptSuccessMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ScanReceivePanel />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ScanPutawayPanel />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ResourceTable
            columns={[
              { header: "PO", key: "po", render: (row) => <RecordLink to={`/inbound/purchase-orders/${row.id}`}>{row.po_number}</RecordLink> },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
              { header: "Supplier", key: "supplier", render: (row) => row.supplier_name },
              { header: "Expected arrival", key: "arrival", render: (row) => formatDateTime(row.expected_arrival_date) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={purchaseOrdersQuery.error ? parseApiError(purchaseOrdersQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={purchaseOrdersQuery.isLoading}
            rows={purchaseOrdersQuery.data?.results ?? []}
            subtitle="Inbound demand waiting to be received"
            title="Purchase orders"
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Receipt", key: "receipt", render: (row) => row.receipt_number },
              { header: "PO", key: "po", render: (row) => row.purchase_order_number },
              { header: "ASN", key: "asn", render: (row) => row.asn_number || "--" },
              { header: "Location", key: "location", render: (row) => row.receipt_location_code },
              { header: "Received", key: "received", render: (row) => formatDateTime(row.received_at) },
            ]}
            error={receiptsQuery.error ? parseApiError(receiptsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={receiptsQuery.isLoading}
            rows={receiptsQuery.data?.results ?? []}
            subtitle="Receipt transactions already posted"
            title="Receipts"
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Task", key: "task", render: (row) => row.task_number },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "From", key: "from", render: (row) => row.from_location_code },
              { header: "To", key: "to", render: (row) => row.to_location_code || "--" },
              { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.quantity) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={putawayTasksQuery.error ? parseApiError(putawayTasksQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={putawayTasksQuery.isLoading}
            rows={putawayTasksQuery.data?.results ?? []}
            subtitle="Putaway execution queue"
            title="Putaway tasks"
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
