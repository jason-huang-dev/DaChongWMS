import Grid from "@mui/material/Grid";
import { Stack } from "@mui/material";

import { useDashboardController } from "@/features/dashboard/controller/useDashboardController";
import { DashboardTable } from "@/features/dashboard/view/DashboardTable";
import { MetricCard } from "@/shared/components/metric-card";
import { PageHeader } from "@/shared/components/page-header";
import { formatDateTime, formatNumber } from "@/shared/utils/format";

export function DashboardPage() {
  const {
    canViewOps,
    canViewFinance,
    warehouseQuery,
    balancesQuery,
    purchaseOrdersQuery,
    salesOrdersQuery,
    approvalsSummaryQuery,
    countingDashboardQuery,
    invoicesQuery,
    firstWarehouse,
    visibleOnHand,
  } = useDashboardController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Operational landing page for warehouse operators. Metrics are driven directly from the backend APIs that the SPA uses elsewhere."
        title="Dashboard"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            helper={firstWarehouse ? `${firstWarehouse.warehouse_city} | ${firstWarehouse.warehouse_manager}` : "No warehouse configured yet."}
            label="Primary warehouse"
            value={firstWarehouse?.warehouse_name ?? "--"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            helper={canViewOps ? "Visible on-hand for the loaded balance page." : "Requires an operations role."}
            label="Inventory balances"
            value={canViewOps ? balancesQuery.data?.count ?? "--" : "Restricted"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            helper={canViewOps ? `${formatNumber(visibleOnHand)} visible units on the first page.` : "Requires an operations role."}
            label="Pending count approvals"
            value={canViewOps ? approvalsSummaryQuery.data?.pending_count ?? "--" : "Restricted"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            helper={canViewFinance ? `${invoicesQuery.data?.count ?? 0} invoices loaded.` : "Requires finance visibility."}
            label="Finance invoices"
            value={canViewFinance ? invoicesQuery.data?.count ?? "--" : "Restricted"}
          />
        </Grid>
        {canViewOps ? (
          <>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <MetricCard
                helper="Rejected variances that still require recount attention."
                label="Rejected variances"
                value={approvalsSummaryQuery.data?.rejected_count ?? "--"}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <MetricCard
                helper="Items already beyond the approval SLA on the supervisor dashboard."
                label="Approval SLA breaches"
                value={countingDashboardQuery.data?.pending_sla_breach_count ?? "--"}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <MetricCard
                helper="Rejected variances that have exceeded the recount SLA."
                label="Recount SLA breaches"
                value={countingDashboardQuery.data?.recount_sla_breach_count ?? "--"}
              />
            </Grid>
          </>
        ) : null}
      </Grid>
      <DashboardTable
        canViewFinance={canViewFinance}
        canViewOps={canViewOps}
        invoicesQuery={invoicesQuery}
        purchaseOrdersQuery={purchaseOrdersQuery}
        salesOrdersQuery={salesOrdersQuery}
      />
    </Stack>
  );
}
