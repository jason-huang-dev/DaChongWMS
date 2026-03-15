import Grid from "@mui/material/Grid";
import { Typography } from "@mui/material";

import type {
  InvoiceRecord,
  PurchaseOrderRecord,
  SalesOrderRecord,
} from "@/features/dashboard/model/types";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface DashboardTableProps {
  canViewFinance: boolean;
  canViewOps: boolean;
  invoicesQuery: PaginatedQueryState<InvoiceRecord>;
  purchaseOrdersQuery: PaginatedQueryState<PurchaseOrderRecord>;
  salesOrdersQuery: PaginatedQueryState<SalesOrderRecord>;
}

export function DashboardTable({
  canViewFinance,
  canViewOps,
  invoicesQuery,
  purchaseOrdersQuery,
  salesOrdersQuery,
}: DashboardTableProps) {
  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            { header: "PO", key: "po", render: (row) => row.po_number },
            { header: "Supplier", key: "supplier", render: (row) => row.supplier_name },
            { header: "Expected", key: "expected", render: (row) => formatDateTime(row.expected_arrival_date) },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
          ]}
          emptyMessage="No inbound purchase orders available."
          error={purchaseOrdersQuery.error ? parseApiError(purchaseOrdersQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={purchaseOrdersQuery.isLoading}
          rows={purchaseOrdersQuery.data?.results ?? []}
          subtitle="Latest inbound work queued for receipt"
          title="Recent purchase orders"
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            { header: "Order", key: "order", render: (row) => row.order_number },
            { header: "Customer", key: "customer", render: (row) => row.customer_name },
            { header: "Ship by", key: "shipBy", render: (row) => formatDateTime(row.requested_ship_date) },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
          ]}
          emptyMessage="No outbound orders available."
          error={salesOrdersQuery.error ? parseApiError(salesOrdersQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={salesOrdersQuery.isLoading}
          rows={salesOrdersQuery.data?.results ?? []}
          subtitle="Latest outbound work queued for allocation and pick"
          title="Recent sales orders"
        />
      </Grid>
      {canViewFinance ? (
        <Grid size={{ xs: 12 }}>
          <ResourceTable
            columns={[
              { header: "Invoice", key: "invoice", render: (row) => row.invoice_number },
              { header: "Issue date", key: "issueDate", render: (row) => formatDateTime(row.issue_date) },
              { header: "Total", key: "total", render: (row) => `${formatNumber(row.total_amount)} ${row.currency}` },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
              { header: "Finance review", key: "financeReview", render: (row) => row.finance_approval?.status ?? "--" },
            ]}
            emptyMessage="No finance invoices available."
            error={invoicesQuery.error ? parseApiError(invoicesQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={invoicesQuery.isLoading}
            rows={invoicesQuery.data?.results ?? []}
            subtitle="Recent invoice work for settlement and remittance"
            title="Recent invoices"
          />
        </Grid>
      ) : null}
      {!canViewOps && !canViewFinance ? (
        <Grid size={{ xs: 12 }}>
          <Typography color="text.secondary" variant="body1">
            This account can authenticate successfully, but its staff role does not currently map to any of the operational routes configured in the SPA.
          </Typography>
        </Grid>
      ) : null}
    </Grid>
  );
}
