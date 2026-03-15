import Grid from "@mui/material/Grid";
import { Button, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useDashboardController } from "@/features/dashboard/controller/useDashboardController";
import { DashboardTable } from "@/features/dashboard/view/DashboardTable";
import { MetricCard } from "@/shared/components/metric-card";
import { PageHeader } from "@/shared/components/page-header";
import { formatNumber } from "@/shared/utils/format";

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    company,
    canViewOps,
    canViewFinance,
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
        actions={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {canViewOps ? (
              <>
                <Button onClick={() => navigate("/inbound")} variant="contained">
                  Receive
                </Button>
                <Button onClick={() => navigate("/outbound")} variant="outlined">
                  Ship
                </Button>
                <Button onClick={() => navigate("/counting")} variant="outlined">
                  Count queue
                </Button>
              </>
            ) : null}
            {canViewFinance ? (
              <Button onClick={() => navigate("/finance")} variant="outlined">
                Finance queue
              </Button>
            ) : null}
          </Stack>
        }
        description={`Operational landing page for warehouse operators. Workspace: ${company?.label ?? "Current tenant"}. Metrics follow the active warehouse context used across the app.`}
        title="Dashboard"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            helper={firstWarehouse ? `${firstWarehouse.warehouse_city} | ${firstWarehouse.warehouse_manager}` : "No warehouse configured yet."}
            label="Active warehouse"
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
