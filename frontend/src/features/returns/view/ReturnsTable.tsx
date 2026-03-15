import Grid from "@mui/material/Grid";

import type {
  ReturnDispositionRecord,
  ReturnOrderRecord,
  ReturnReceiptRecord,
} from "@/features/returns/model/types";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface ReturnsTableProps {
  returnOrdersQuery: PaginatedQueryState<ReturnOrderRecord>;
  receiptsQuery: PaginatedQueryState<ReturnReceiptRecord>;
  dispositionsQuery: PaginatedQueryState<ReturnDispositionRecord>;
}

export function ReturnsTable({
  returnOrdersQuery,
  receiptsQuery,
  dispositionsQuery,
}: ReturnsTableProps) {
  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12 }}>
        <ResourceTable
          columns={[
            {
              header: "Return",
              key: "return",
              render: (row) => (
                <RecordLink to={`/returns/return-orders/${row.id}`}>
                  {row.return_number}
                </RecordLink>
              ),
            },
            { header: "Customer", key: "customer", render: (row) => row.customer_name },
            {
              header: "Sales order",
              key: "salesOrder",
              render: (row) => row.sales_order_number || "--",
            },
            { header: "Requested", key: "requested", render: (row) => formatDateTime(row.requested_date) },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
          ]}
          error={returnOrdersQuery.error ? parseApiError(returnOrdersQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={returnOrdersQuery.isLoading}
          rows={returnOrdersQuery.data?.results ?? []}
          subtitle="Expected customer returns by order"
          title="Return orders"
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            { header: "Receipt", key: "receipt", render: (row) => row.receipt_number },
            { header: "Return", key: "return", render: (row) => row.return_number },
            { header: "SKU", key: "sku", render: (row) => row.goods_code },
            { header: "Location", key: "location", render: (row) => row.receipt_location_code },
            { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.received_qty) },
            { header: "Received", key: "received", render: (row) => formatDateTime(row.received_at) },
          ]}
          error={receiptsQuery.error ? parseApiError(receiptsQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={receiptsQuery.isLoading}
          rows={receiptsQuery.data?.results ?? []}
          subtitle="Posted warehouse receipts against return lines"
          title="Return receipts"
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            { header: "Disposition", key: "disposition", render: (row) => row.disposition_number },
            { header: "Return", key: "return", render: (row) => row.return_number },
            { header: "Receipt", key: "receipt", render: (row) => row.receipt_number },
            { header: "Type", key: "type", render: (row) => row.disposition_type },
            { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.quantity) },
            { header: "Completed", key: "completed", render: (row) => formatDateTime(row.completed_at) },
          ]}
          error={dispositionsQuery.error ? parseApiError(dispositionsQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={dispositionsQuery.isLoading}
          rows={dispositionsQuery.data?.results ?? []}
          subtitle="Final handling outcome for received return stock"
          title="Return dispositions"
        />
      </Grid>
    </Grid>
  );
}
